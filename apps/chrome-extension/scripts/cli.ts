import { cac } from 'cac'
import { execa } from 'execa'
import { build as tsdownBuild } from 'tsdown'
import { createBuilder } from 'rolldown-vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packageJson from '../package.json' with { type: 'json' }

const dirname = fileURLToPath(new URL('./', import.meta.url))
const extensionRoot = path.resolve(dirname, '..')
const distPath = path.join(extensionRoot, 'dist')
const manifestPath = path.join(extensionRoot, 'manifest.json')

const browserTargets = ['chromium', 'firefox'] as const

type BrowserTarget = (typeof browserTargets)[number]

interface FirefoxBackgroundOptions {
  scripts: string[]
  type: 'module'
}

interface ChromeBackgroundOptions {
  service_worker: string
  type: 'module'
}

interface Manifest {
  version?: string
  background?: FirefoxBackgroundOptions | ChromeBackgroundOptions
  browser_specific_settings?: {
    gecko: {
      id: string
      data_collection_permissions?: {
        required: ['none']
      }
    }
  }
}

interface CliOptions {
  release: boolean
  target: string
}

interface BuildOptions {
  release: boolean
  target: BrowserTarget
}

const isBrowserTarget = (target: string): target is BrowserTarget =>
  browserTargets.includes(target as BrowserTarget)

const readManifest = async (): Promise<Manifest> => {
  const fileContent = await fs.readFile(manifestPath, 'utf8')
  return JSON.parse(fileContent) as Manifest
}

const cleanDist = async () => {
  await fs.rm(distPath, {
    recursive: true,
    force: true,
  })
}

const buildScripts = async (options: BuildOptions) => {
  await tsdownBuild({
    env: {
      DEV: !options.release,
    },
  })
}

const buildPages = async (options: BuildOptions) => {
  const builder = await createBuilder(
    {
      mode: options.release ? 'release' : undefined,
    },
    null,
  )
  await builder.buildApp()
}

const copyStaticAssets = async () => {
  interface CopyEntry {
    from: string
    to: string
  }

  const copyEntries: CopyEntry[] = [
    {
      from: path.join(extensionRoot, 'images'),
      to: path.join(distPath, 'images'),
    },
  ]

  await Promise.all(
    copyEntries.map(entry =>
      fs.cp(entry.from, entry.to, {
        recursive: true,
      }),
    ),
  )
}

const writeManifest = async (options: BuildOptions) => {
  const manifest = await readManifest()

  if (!manifest.background) {
    throw new Error('manifest.background not found')
  }

  if (options.target === 'firefox' && 'service_worker' in manifest.background) {
    manifest.background = {
      scripts: [manifest.background.service_worker],
      type: 'module',
    }

    manifest.browser_specific_settings = {
      gecko: {
        id: 'zhangpengfei.xyz@outlook.com',
        data_collection_permissions: {
          required: ['none'],
        },
      },
    }
  }

  manifest.version = packageJson.version

  await fs.writeFile(
    path.join(distPath, 'manifest.json'),
    JSON.stringify(manifest, null, options.release ? undefined : 2),
  )

  console.log(`\n--- build end ---\n`)
  console.log(`Extension version: ${manifest.version}`)
}

const lintFirefoxExtension = async () => {
  for await (const line of execa('pnpm', [
    'exec',
    'web-ext',
    'lint',
    '--source-dir',
    distPath,
  ])) {
    console.log(`web-ext lint: ${line}`)
  }
}

const buildExtension = async (options: BuildOptions) => {
  console.log('--- clean dist start ---\n')

  await cleanDist()

  console.log('--- build scripts start ---\n')

  await buildScripts(options)

  console.log('\n--- build pages start ---\n')

  await buildPages(options)

  await copyStaticAssets()

  await writeManifest(options)

  if (options.target === 'firefox') {
    await lintFirefoxExtension()
  }
}

const cli = cac('@feishu-doc2md/chrome-extension')
cli.help().version(packageJson.version)

cli
  .command('build', 'build the browser extension', {
    ignoreOptionDefaultValue: false,
  })
  .option(
    '-r, --release',
    'Build artifacts in release mode, with optimizations',
    {
      default: false,
    },
  )
  .option('--target <target>', 'Browser target, e.g "chromium", "firefox"', {
    default: 'chromium',
  })
  .action(async (options: CliOptions) => {
    if (!isBrowserTarget(options.target)) {
      throw new Error(`'Invalid target: ${options.target}'`)
    }

    await buildExtension({
      release: options.release,
      target: options.target,
    })
  })

cli.parse(process.argv, { run: false })

await cli.runMatchedCommand()
