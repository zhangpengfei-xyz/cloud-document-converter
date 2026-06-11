import { defineConfig, type UserConfig as Options } from 'tsdown'
import { glob } from 'glob'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { escapeRegExp } from 'es-toolkit/string'
import packageJson from './package.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async cliOptions => {
  const isDev = Boolean(cliOptions.env?.['DEV'])

  const noExternal = Object.keys(packageJson.dependencies).map(
    dependency => new RegExp(`^${escapeRegExp(dependency)}`),
  )

  const sharedConfig: Omit<Options, 'config' | 'filter'> = {
    inputOptions: {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    },
    platform: 'browser',
    target: ['es2024'],
    noExternal,
    minify: !isDev,
  }

  const createModuleScriptConfig = (
    entry: Options['entry'],
  ): Omit<Options, 'config' | 'filter'> => ({
    entry,
    outDir: 'dist/bundles',
    format: 'esm',
    tsconfig: 'tsconfig.extension.json',
    ...sharedConfig,
  })

  const createClassicScriptConfig = (
    entry: Options['entry'],
  ): Omit<Options, 'config' | 'filter'> => ({
    entry,
    outDir: 'dist/bundles',
    format: 'iife',
    outputOptions: {
      entryFileNames: '[name].js',
    },
    tsconfig: 'tsconfig.web.json',
    ...sharedConfig,
  })

  return [
    createModuleScriptConfig({
      background: 'src/background.ts',
    }),
    ...(
      [
        { content: 'src/content.ts' },
        ...(await glob('src/scripts/*.ts')).map(entry => ({
          [`scripts/${path.parse(entry).name}`]: entry,
        })),
      ] satisfies Options['entry'][]
    ).map(createClassicScriptConfig),
  ]
})
