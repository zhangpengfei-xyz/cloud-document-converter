export {}

interface CliOptions {
  debugUrl: string
  urlPrefix: string
  rootExpression: string
  text: string
  match: MatchMode
  targets: TargetSelection
  contexts: ContextSelection
  maxMs: number
  maxNodes: number
  maxEdges: number
  maxHits: number
  includePrototypes: boolean
  format: OutputFormat
  search: SearchOptions
}

interface SearchOptions {
  fieldName: boolean
  mapKey: boolean
  fieldValue: boolean
  mapValue: boolean
}

interface ScanOptions extends SearchOptions {
  match: MatchMode
  maxMs: number
  maxNodes: number
  maxEdges: number
  maxHits: number
  includePrototypes: boolean
}

interface Hit {
  kind: HitKind
  path: string
  ownerPath: string
  owner: ValueDescription
  key?: MatchSummary
  value?: MatchSummary
}

interface ContextResult {
  context: ExecutionContextSummary
  result: ScanResult | EvaluationError
}

interface TargetResult {
  target: TargetSummary
  contextsSeen?: number
  contextsScanned?: number
  contextResults?: ContextResult[]
  error?: string
}

interface OutputHit extends Hit {
  targetId: string
  targetType: string
  targetUrl: string
  contextId: number
  contextOrigin: string
  contextName: string
  contextAuxData?: JsonObject
}

interface ScanResult {
  rootFound: boolean
  rootPath: string
  rootDescription?: ValueDescription
  found: boolean
  totalMatches: number
  hitCountsByKind: Record<string, number>
  hits: Hit[]
  stats: ScanStats
}

interface ScanStats {
  nodes: number
  edges: number
  queued: number
  remaining: number
  maxQueue: number
  elapsedMs: number
  timedOut: boolean
  nodeLimitReached: boolean
  edgeLimitReached: boolean
  storedHitLimitReached: boolean
  maxNodes: number
  maxEdges: number
  maxMs: number
  errors: Record<string, number>
}

interface EvaluationError {
  found: false
  rootFound?: false
  error: unknown
}

interface TargetSummary {
  id: string
  parentId?: string
  type: string
  title: string
  url: string
}

interface ExecutionContextSummary {
  id: number
  name: string
  origin: string
  auxData?: JsonObject
}

interface ValueDescription {
  type: string
  tag: string
  ctor?: string
  mapSize?: number
}

interface MatchSummary {
  type: string
  length?: number
  matchIndex?: number
  value?: string
  description?: string
}

interface CdpTarget extends TargetSummary {
  webSocketDebuggerUrl?: string
}

interface CdpMessage {
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

interface RuntimeContextCreatedParams {
  context?: {
    id?: unknown
    name?: unknown
    origin?: unknown
    auxData?: unknown
  }
}

type HitKind = 'field.name' | 'field.value' | 'Map.key' | 'Map.value'
type MatchMode = 'exact' | 'contains'
type TargetSelection = 'all' | 'page' | 'worker'
type ContextSelection = 'all' | 'default'
type OutputFormat = 'json' | 'text'
type JsonObject = Record<string, unknown>

const defaultOptions: CliOptions = {
  debugUrl: 'http://127.0.0.1:9222',
  urlPrefix: 'https://bytedance.larkoffice.com/',
  rootExpression: 'globalThis',
  text: '',
  match: 'contains',
  targets: 'all',
  contexts: 'all',
  maxMs: 60000,
  maxNodes: 3500000,
  maxEdges: 20000000,
  maxHits: 0,
  includePrototypes: true,
  format: 'json',
  search: {
    fieldName: false,
    mapKey: false,
    fieldValue: false,
    mapValue: false,
  },
}

const usage = `Usage:
  pnpm cdp:find -- --text <string> [options]

Examples:
  # Find Map keys and object field names exactly equal to a sheet id.
  pnpm --filter @feishu-doc2md/chrome-extension cdp:find -- --text 5ogD9a --search keys

  # Find field values and Map values containing text under a specific object.
  pnpm --filter @feishu-doc2md/chrome-extension cdp:find -- --root 'globalThis.spread.sheets["4"]' --text 定责依据 --search values --match contains

Options:
  --debug-url <url>      Chrome DevTools HTTP endpoint. Default: http://127.0.0.1:9222
  --url-prefix <prefix>  Page/worker URL prefix to include. Default: https://bytedance.larkoffice.com/
  --root <expr>          JavaScript root expression evaluated in each context. Default: globalThis
  --text <string>        Required search string.
  --search <scope>       all | keys | values | field-name,map-key,field-value,map-value. Default: all
  --field-name           Search object own property names.
  --map-key              Search Map keys.
  --field-value          Search object own data property string values.
  --map-value            Search Map string values.
  --match <mode>         exact | contains. Default: exact
  --targets <scope>      all | page | worker. Default: all
  --contexts <scope>     all | default. Default: all
  --max-ms <n>           Per-context scan time budget. Default: 60000
  --max-nodes <n>        Per-context object/function node budget. Default: 3500000
  --max-edges <n>        Per-context edge budget. Default: 20000000
  --max-hits <n>         Per-context stored hit cap. 0 means unlimited. Default: 0
  --no-prototypes        Do not traverse prototypes.
  --format <format>      json | text. Default: json
  --help                 Show this help.
`

class CdpClient {
  private nextId = 1
  private readonly wsUrl: string
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (reason: Error) => void
    }
  >()
  private readonly handlers = new Map<string, ((params: unknown) => void)[]>()
  private ws?: WebSocket

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl
  }

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.wsUrl)
    this.ws.addEventListener('message', event => {
      const message = parseCdpMessage(event.data)

      if (message.id !== undefined && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)

        if (!pending) return

        if (message.error !== undefined) {
          pending.reject(new Error(JSON.stringify(message.error)))
        } else {
          pending.resolve(message.result)
        }

        return
      }

      if (!message.method) return

      const handlers = this.handlers.get(message.method)
      if (!handlers) return

      for (const handler of handlers) {
        handler(message.params)
      }
    })

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'))
        return
      }

      this.ws.addEventListener(
        'open',
        () => {
          resolve()
        },
        { once: true },
      )
      this.ws.addEventListener(
        'error',
        () => {
          reject(new Error(`WebSocket error for ${this.wsUrl}`))
        },
        { once: true },
      )
    })
  }

  on(method: string, handler: (params: unknown) => void): void {
    const handlers = this.handlers.get(method) ?? []
    handlers.push(handler)
    this.handlers.set(method, handlers)
  }

  send(method: string, params: JsonObject = {}): Promise<unknown> {
    if (!this.ws) {
      throw new Error('WebSocket not connected')
    }

    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  close(): void {
    this.ws?.close()
  }
}

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null

const parseCdpMessage = (value: unknown): CdpMessage => {
  const parsed = JSON.parse(String(value)) as unknown
  if (!isRecord(parsed)) return {}

  return {
    id: typeof parsed['id'] === 'number' ? parsed['id'] : undefined,
    method: typeof parsed['method'] === 'string' ? parsed['method'] : undefined,
    params: parsed['params'],
    result: parsed['result'],
    error: parsed['error'],
  }
}

const readString = (record: JsonObject, key: string): string | undefined =>
  typeof record[key] === 'string' ? record[key] : undefined

const readNumber = (record: JsonObject, key: string): number | undefined =>
  typeof record[key] === 'number' ? record[key] : undefined

const readObject = (record: JsonObject, key: string): JsonObject | undefined =>
  isRecord(record[key]) ? record[key] : undefined

const parseTargets = (value: unknown): CdpTarget[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item): CdpTarget[] => {
    if (!isRecord(item)) return []

    const id = readString(item, 'id')
    const type = readString(item, 'type')
    const title = readString(item, 'title')
    const url = readString(item, 'url')

    if (!id || !type || title === undefined || url === undefined) return []

    return [
      {
        id,
        parentId: readString(item, 'parentId'),
        type,
        title,
        url,
        webSocketDebuggerUrl: readString(item, 'webSocketDebuggerUrl'),
      },
    ]
  })
}

const parseContextCreated = (
  params: unknown,
): ExecutionContextSummary | null => {
  if (!isRecord(params)) return null

  const event = params as RuntimeContextCreatedParams
  const context = event.context
  if (!isRecord(context)) return null

  const id = readNumber(context, 'id')
  if (id === undefined) return null

  return {
    id,
    name: readString(context, 'name') ?? '',
    origin: readString(context, 'origin') ?? '',
    auxData: readObject(context, 'auxData'),
  }
}

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    ...defaultOptions,
    search: { ...defaultOptions.search },
  }
  let explicitSearch = false

  const nextValue = (index: number, key: string): [string, number] => {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${key}`)
    }

    const value = argv[index + 1]
    if (value.startsWith('--')) {
      throw new Error(`Missing value for ${key}`)
    }

    return [value, index + 1]
  }

  for (let index = 0; index < argv.length; index++) {
    const rawArg = argv[index]
    if (rawArg === '--') continue

    const [arg, inlineValue] = rawArg.includes('=')
      ? (rawArg.split(/=(.*)/s, 2) as [string, string])
      : [rawArg, undefined]

    const readValue = (key: string): string => {
      if (inlineValue !== undefined) return inlineValue

      const [value, nextIndex] = nextValue(index, key)
      index = nextIndex
      return value
    }

    switch (arg) {
      case '--help':
      case '-h':
        console.log(usage)
        process.exit(0)
        break
      case '--debug-url':
        options.debugUrl = readValue(arg)
        break
      case '--url-prefix':
        options.urlPrefix = readValue(arg)
        break
      case '--root':
        options.rootExpression = readValue(arg)
        break
      case '--text':
        options.text = readValue(arg)
        break
      case '--search':
        options.search = parseSearch(readValue(arg))
        explicitSearch = true
        break
      case '--field-name':
        options.search.fieldName = true
        explicitSearch = true
        break
      case '--map-key':
        options.search.mapKey = true
        explicitSearch = true
        break
      case '--field-value':
        options.search.fieldValue = true
        explicitSearch = true
        break
      case '--map-value':
        options.search.mapValue = true
        explicitSearch = true
        break
      case '--match':
        options.match = parseMatchMode(readValue(arg))
        break
      case '--targets':
        options.targets = parseTargetSelection(readValue(arg))
        break
      case '--contexts':
        options.contexts = parseContextSelection(readValue(arg))
        break
      case '--max-ms':
        options.maxMs = parsePositiveInteger(readValue(arg), arg)
        break
      case '--max-nodes':
        options.maxNodes = parsePositiveInteger(readValue(arg), arg)
        break
      case '--max-edges':
        options.maxEdges = parsePositiveInteger(readValue(arg), arg)
        break
      case '--max-hits':
        options.maxHits = parseNonNegativeInteger(readValue(arg), arg)
        break
      case '--no-prototypes':
        options.includePrototypes = false
        break
      case '--format':
        options.format = parseOutputFormat(readValue(arg))
        break
      default:
        throw new Error(`Unknown option: ${rawArg}`)
    }
  }

  if (!explicitSearch) {
    options.search = {
      fieldName: true,
      mapKey: true,
      fieldValue: true,
      mapValue: true,
    }
  }

  if (!options.text) {
    throw new Error('--text is required')
  }

  return options
}

const parseSearch = (value: string): SearchOptions => {
  const search: SearchOptions = {
    fieldName: false,
    mapKey: false,
    fieldValue: false,
    mapValue: false,
  }

  const tokens = value.split(',').map(token => token.trim())

  for (const token of tokens) {
    switch (token) {
      case 'all':
        return {
          fieldName: true,
          mapKey: true,
          fieldValue: true,
          mapValue: true,
        }
      case 'keys':
        search.fieldName = true
        search.mapKey = true
        break
      case 'values':
        search.fieldValue = true
        search.mapValue = true
        break
      case 'field-name':
        search.fieldName = true
        break
      case 'map-key':
        search.mapKey = true
        break
      case 'field-value':
        search.fieldValue = true
        break
      case 'map-value':
        search.mapValue = true
        break
      default:
        throw new Error(`Invalid --search token: ${token}`)
    }
  }

  return search
}

const parseMatchMode = (value: string): MatchMode => {
  if (value === 'exact' || value === 'contains') return value
  throw new Error(`Invalid --match: ${value}`)
}

const parseTargetSelection = (value: string): TargetSelection => {
  if (value === 'all' || value === 'page' || value === 'worker') return value
  throw new Error(`Invalid --targets: ${value}`)
}

const parseContextSelection = (value: string): ContextSelection => {
  if (value === 'all' || value === 'default') return value
  throw new Error(`Invalid --contexts: ${value}`)
}

const parseOutputFormat = (value: string): OutputFormat => {
  if (value === 'json' || value === 'text') return value
  throw new Error(`Invalid --format: ${value}`)
}

const parsePositiveInteger = (value: string, key: string): number => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }
  return parsed
}

const parseNonNegativeInteger = (value: string, key: string): number => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`)
  }
  return parsed
}

const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)} for ${url}`)
  }
  return response.json() as Promise<unknown>
}

const isDefaultContext = (context: ExecutionContextSummary): boolean => {
  const auxData = context.auxData
  if (!auxData) return false

  return auxData['type'] === 'default' || auxData['isDefault'] === true
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

const shouldIncludeTarget = (
  target: CdpTarget,
  pageIds: Set<string>,
  options: CliOptions,
): boolean => {
  if (!target.webSocketDebuggerUrl) return false

  if (target.type === 'page') {
    return (
      options.targets !== 'worker' && target.url.startsWith(options.urlPrefix)
    )
  }

  if (target.type !== 'worker' && target.type !== 'service_worker') {
    return false
  }

  if (options.targets === 'page') return false

  return (
    (target.parentId !== undefined && pageIds.has(target.parentId)) ||
    target.url.startsWith(`blob:${options.urlPrefix}`) ||
    target.url.startsWith(options.urlPrefix)
  )
}

const scanTarget = async (
  target: CdpTarget,
  options: CliOptions,
): Promise<TargetResult> => {
  if (!target.webSocketDebuggerUrl) {
    throw new Error(`Target has no webSocketDebuggerUrl: ${target.id}`)
  }

  const cdp = new CdpClient(target.webSocketDebuggerUrl)
  const contexts: ExecutionContextSummary[] = []
  cdp.on('Runtime.executionContextCreated', params => {
    const context = parseContextCreated(params)
    if (context) contexts.push(context)
  })

  await cdp.connect()

  try {
    await cdp.send('Runtime.enable')
    await sleep(250)

    const selectedContexts =
      options.contexts === 'default'
        ? contexts.filter(isDefaultContext)
        : contexts
    const contextResults: ContextResult[] = []

    for (const context of selectedContexts) {
      const scanOptions: ScanOptions = {
        ...options.search,
        match: options.match,
        maxMs: options.maxMs,
        maxNodes: options.maxNodes,
        maxEdges: options.maxEdges,
        maxHits: options.maxHits,
        includePrototypes: options.includePrototypes,
      }
      const expression = `(${pageSearchSource().toString()})(${JSON.stringify(options.text)}, () => (${options.rootExpression}), ${JSON.stringify(options.rootExpression)}, ${JSON.stringify(scanOptions)})`
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        contextId: context.id,
        awaitPromise: true,
        returnByValue: true,
        silent: true,
        timeout: options.maxMs + 5000,
      })

      contextResults.push({
        context,
        result: parseEvaluationResult(result),
      })
    }

    return {
      target: {
        id: target.id,
        parentId: target.parentId,
        type: target.type,
        title: target.title,
        url: target.url,
      },
      contextsSeen: contexts.length,
      contextsScanned: selectedContexts.length,
      contextResults,
    }
  } finally {
    cdp.close()
  }
}

const parseEvaluationResult = (
  value: unknown,
): ScanResult | EvaluationError => {
  if (!isRecord(value)) {
    return {
      found: false,
      error: value,
    }
  }

  const resultRecord = readObject(value, 'result')
  const resultValue = resultRecord ? resultRecord['value'] : undefined

  if (!isRecord(resultValue)) {
    return {
      found: false,
      error: readObject(value, 'exceptionDetails') ?? value,
    }
  }

  return resultValue as unknown as ScanResult
}

const pageSearchSource = () => {
  return function searchCdpObjectGraph(
    searchText: string,
    readRoot: () => unknown,
    rootPath: string,
    options: ScanOptions,
  ): ScanResult {
    const start = Date.now()
    const maxPathLength = 1000
    const visited = new WeakSet()
    const queue: { value: object; path: string }[] = []
    let queueIndex = 0
    let nodes = 0
    let edges = 0
    let maxQueue = 0
    let totalMatches = 0
    let timedOut = false
    let nodeLimitReached = false
    let edgeLimitReached = false
    let storedHitLimitReached = false
    const hitCountsByKind: Record<string, number> = {}
    const errors: Record<string, number> = {
      root: 0,
      ownKeys: 0,
      descriptor: 0,
      prototype: 0,
      map: 0,
      set: 0,
      weakCollection: 0,
    }
    const hits: Hit[] = []

    const incrementError = (key: string) => {
      errors[key] = (errors[key] ?? 0) + 1
    }
    const nowExceeded = () => Date.now() - start > options.maxMs
    const truncate = (text: string, max = maxPathLength) =>
      text.length <= max ? text : `${text.slice(0, max - 20)}...<truncated>`
    const isTraversable = (value: unknown): value is object =>
      (typeof value === 'object' || typeof value === 'function') &&
      value !== null

    const safeDescribe = (value: unknown): ValueDescription => {
      let tag = '[object Unknown]'
      let ctor: string | undefined
      try {
        tag = Object.prototype.toString.call(value)
      } catch {
        // Some values can reject introspection.
      }
      try {
        const maybeCtor = (value as { constructor?: { name?: unknown } } | null)
          ?.constructor?.name
        ctor = typeof maybeCtor === 'string' ? maybeCtor : undefined
      } catch {
        // Some values can reject introspection.
      }
      return { type: typeof value, tag, ctor }
    }

    const keySegment = (key: string | symbol): string => {
      if (typeof key === 'symbol') return `[${truncate(String(key), 160)}]`
      return /^[A-Za-z_$][\w$]*$/.test(key)
        ? `.${key}`
        : `[${JSON.stringify(truncate(key, 160))}]`
    }

    const entryPath = (
      base: string,
      container: string,
      index: number,
      slot: string,
    ) => truncate(`${base}.[[${container}]][${String(index)}].${slot}`)

    const matchesText = (value: unknown): boolean => {
      if (typeof value !== 'string') return false
      return options.match === 'exact'
        ? value === searchText
        : value.includes(searchText)
    }

    const summarizeString = (value: string): MatchSummary => ({
      type: 'string',
      length: value.length,
      matchIndex: value.indexOf(searchText),
    })

    const addHit = (hit: Hit) => {
      totalMatches++
      hitCountsByKind[hit.kind] = (hitCountsByKind[hit.kind] ?? 0) + 1

      if (options.maxHits > 0 && hits.length >= options.maxHits) {
        storedHitLimitReached = true
        return
      }

      hits.push(hit)
    }

    const enqueue = (value: unknown, path: string) => {
      if (!isTraversable(value)) return
      if (visited.has(value)) return
      visited.add(value)
      queue.push({ value, path: truncate(path) })
      maxQueue = Math.max(maxQueue, queue.length - queueIndex)
    }

    const checkFieldName = (
      key: string | symbol,
      path: string,
      ownerPath: string,
      owner: ValueDescription,
    ) => {
      if (!options.fieldName) return

      const keyText = typeof key === 'symbol' ? String(key) : key
      if (!matchesText(keyText)) return

      addHit({
        kind: 'field.name',
        path,
        ownerPath,
        owner,
        key: summarizeString(keyText),
      })
    }

    const checkStringValue = (
      value: unknown,
      path: string,
      kind: HitKind,
      ownerPath: string,
      owner: ValueDescription,
    ) => {
      if (!matchesText(value)) return

      addHit({
        kind,
        path,
        ownerPath,
        owner,
        value: summarizeString(value as string),
      })
    }

    const scanMap = (obj: object, path: string, owner: ValueDescription) => {
      let size: number | undefined
      try {
        size = (obj as Map<unknown, unknown>).size
      } catch {
        // Some cross-realm or proxy values can reject Map size access.
      }

      let index = 0
      try {
        for (const [key, value] of Map.prototype.entries.call(
          obj,
        ) as IterableIterator<[unknown, unknown]>) {
          edges += 2

          const keyPath = entryPath(path, 'MapData', index, 'key')
          const valuePath = entryPath(path, 'MapData', index, 'value')
          const mapOwner = {
            ...owner,
            mapSize: typeof size === 'number' ? size : undefined,
          }

          if (options.mapKey) {
            checkStringValue(key, keyPath, 'Map.key', path, mapOwner)
          }

          if (options.mapValue) {
            checkStringValue(value, valuePath, 'Map.value', path, mapOwner)
          }

          enqueue(key, keyPath)
          enqueue(value, valuePath)

          index++
          if (nowExceeded()) {
            timedOut = true
            break
          }
          if (edges >= options.maxEdges) {
            edgeLimitReached = true
            break
          }
        }
      } catch {
        incrementError('map')
      }
    }

    const scanSet = (obj: object, path: string) => {
      let index = 0
      try {
        for (const value of Set.prototype.values.call(
          obj,
        ) as IterableIterator<unknown>) {
          edges++
          enqueue(value, entryPath(path, 'SetData', index, 'value'))
          index++
          if (nowExceeded()) {
            timedOut = true
            break
          }
          if (edges >= options.maxEdges) {
            edgeLimitReached = true
            break
          }
        }
      } catch {
        incrementError('set')
      }
    }

    let root: unknown
    try {
      root = readRoot()
    } catch {
      incrementError('root')
      return {
        rootFound: false,
        rootPath,
        found: false,
        totalMatches: 0,
        hitCountsByKind,
        hits,
        stats: {
          nodes,
          edges,
          queued: queue.length,
          remaining: 0,
          maxQueue,
          elapsedMs: Date.now() - start,
          timedOut,
          nodeLimitReached,
          edgeLimitReached,
          storedHitLimitReached,
          maxNodes: options.maxNodes,
          maxEdges: options.maxEdges,
          maxMs: options.maxMs,
          errors,
        },
      }
    }

    enqueue(root, rootPath)

    while (queueIndex < queue.length) {
      if (nowExceeded()) {
        timedOut = true
        break
      }
      if (nodes >= options.maxNodes) {
        nodeLimitReached = true
        break
      }
      if (edges >= options.maxEdges) {
        edgeLimitReached = true
        break
      }

      const { value: obj, path } = queue[queueIndex]
      queueIndex++
      nodes++

      const owner = safeDescribe(obj)
      const tag = owner.tag

      if (tag === '[object Map]') {
        scanMap(obj, path, owner)
      } else if (tag === '[object Set]') {
        scanSet(obj, path)
      } else if (tag === '[object WeakMap]' || tag === '[object WeakSet]') {
        incrementError('weakCollection')
      }

      let keys: (string | symbol)[]
      try {
        keys = Reflect.ownKeys(obj)
      } catch {
        incrementError('ownKeys')
        keys = []
      }

      for (const key of keys) {
        if (nowExceeded()) {
          timedOut = true
          break
        }
        if (edges >= options.maxEdges) {
          edgeLimitReached = true
          break
        }

        edges++
        const childPath = truncate(`${path}${keySegment(key)}`)

        checkFieldName(key, childPath, path, owner)

        let descriptor: PropertyDescriptor | undefined
        try {
          descriptor = Object.getOwnPropertyDescriptor(obj, key)
        } catch {
          incrementError('descriptor')
          continue
        }

        if (!descriptor) continue

        if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          if (options.fieldValue) {
            checkStringValue(
              descriptor.value,
              childPath,
              'field.value',
              path,
              owner,
            )
          }
          enqueue(descriptor.value, childPath)
        } else {
          enqueue(
            Reflect.get(descriptor, 'get') as unknown,
            `${childPath}.[[Getter]]`,
          )
          enqueue(
            Reflect.get(descriptor, 'set') as unknown,
            `${childPath}.[[Setter]]`,
          )
        }
      }

      if (options.includePrototypes) {
        try {
          enqueue(Object.getPrototypeOf(obj), `${path}.[[Prototype]]`)
        } catch {
          incrementError('prototype')
        }
      }
    }

    return {
      rootFound: isTraversable(root),
      rootPath,
      rootDescription: safeDescribe(root),
      found: totalMatches > 0,
      totalMatches,
      hitCountsByKind,
      hits,
      stats: {
        nodes,
        edges,
        queued: queue.length,
        remaining: Math.max(0, queue.length - queueIndex),
        maxQueue,
        elapsedMs: Date.now() - start,
        timedOut,
        nodeLimitReached,
        edgeLimitReached,
        storedHitLimitReached,
        maxNodes: options.maxNodes,
        maxEdges: options.maxEdges,
        maxMs: options.maxMs,
        errors,
      },
    }
  }
}

const buildOutput = (results: TargetResult[], options: CliOptions) => {
  let totalMatches = 0
  const countsByKind: Record<string, number> = {}
  const hits: OutputHit[] = []

  for (const targetResult of results) {
    for (const contextResult of targetResult.contextResults ?? []) {
      const result = contextResult.result
      if ('totalMatches' in result) {
        totalMatches += result.totalMatches

        for (const [kind, count] of Object.entries(result.hitCountsByKind)) {
          countsByKind[kind] = (countsByKind[kind] ?? 0) + count
        }

        for (const hit of result.hits) {
          hits.push({
            targetId: targetResult.target.id,
            targetType: targetResult.target.type,
            targetUrl: targetResult.target.url,
            contextId: contextResult.context.id,
            contextOrigin: contextResult.context.origin,
            contextName: contextResult.context.name,
            contextAuxData: contextResult.context.auxData,
            ...hit,
          })
        }
      }
    }
  }

  hits.sort((a, b) => {
    const left = `${a.targetId}:${String(a.contextId)}:${a.kind}:${a.path}`
    const right = `${b.targetId}:${String(b.contextId)}:${b.kind}:${b.path}`
    return left.localeCompare(right)
  })

  return {
    query: {
      debugUrl: options.debugUrl,
      urlPrefix: options.urlPrefix,
      rootExpression: options.rootExpression,
      text: options.text,
      match: options.match,
      targets: options.targets,
      contexts: options.contexts,
      search: options.search,
      includePrototypes: options.includePrototypes,
    },
    found: totalMatches > 0,
    totalMatches,
    countsByKind,
    storedHitCount: hits.length,
    hits,
    targetStats: results.map(targetResult => ({
      target: targetResult.target,
      error: targetResult.error,
      contextsSeen: targetResult.contextsSeen,
      contextsScanned: targetResult.contextsScanned,
      contexts: (targetResult.contextResults ?? []).map(contextResult => {
        const result = contextResult.result
        return {
          context: contextResult.context,
          found: result.found,
          totalMatches: 'totalMatches' in result ? result.totalMatches : 0,
          storedHitCount:
            'hits' in result && Array.isArray(result.hits)
              ? result.hits.length
              : 0,
          hitCountsByKind:
            'hitCountsByKind' in result ? result.hitCountsByKind : {},
          stats: 'stats' in result ? result.stats : undefined,
          error: 'error' in result ? result.error : undefined,
        }
      }),
    })),
  }
}

const printTextOutput = (output: ReturnType<typeof buildOutput>): void => {
  console.log(`found: ${String(output.found)}`)
  console.log(`totalMatches: ${String(output.totalMatches)}`)
  console.log(`countsByKind: ${JSON.stringify(output.countsByKind)}`)
  console.log(`storedHitCount: ${String(output.storedHitCount)}`)
  console.log('')

  for (const [index, hit] of output.hits.entries()) {
    console.log(`${String(index + 1)}. [${hit.kind}] ${hit.path}`)
    console.log(
      `   target=${hit.targetType}:${hit.targetId} context=${String(hit.contextId)}`,
    )
    console.log(`   owner=${hit.ownerPath}`)
  }

  const limitedContexts = output.targetStats.flatMap(target =>
    target.contexts.filter(context => {
      const stats = context.stats
      return [
        stats?.timedOut ?? false,
        stats?.nodeLimitReached ?? false,
        stats?.edgeLimitReached ?? false,
        stats?.storedHitLimitReached ?? false,
        (stats?.remaining ?? 0) > 0,
      ].some(Boolean)
    }),
  )

  if (limitedContexts.length > 0) {
    console.log('')
    console.log(
      'WARNING: at least one context hit a scan limit; JSON output has details.',
    )
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const allTargets = parseTargets(
    await getJson(`${options.debugUrl}/json/list`),
  )
  const pageTargets = allTargets.filter(
    target =>
      target.type === 'page' && target.url.startsWith(options.urlPrefix),
  )
  const pageIds = new Set(pageTargets.map(target => target.id))
  const scanTargets = allTargets.filter(target =>
    shouldIncludeTarget(target, pageIds, options),
  )

  const results: TargetResult[] = []

  for (const target of scanTargets) {
    try {
      results.push(await scanTarget(target, options))
    } catch (error) {
      results.push({
        target: {
          id: target.id,
          parentId: target.parentId,
          type: target.type,
          title: target.title,
          url: target.url,
        },
        error: error instanceof Error ? error.stack : String(error),
      })
    }
  }

  const output = buildOutput(results, options)

  if (options.format === 'json') {
    console.log(JSON.stringify(output, null, 2))
  } else {
    printTextOutput(output)
  }
}

await main()
