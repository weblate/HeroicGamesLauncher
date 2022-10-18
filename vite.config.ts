import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'

const aliases = [
  {
    find: '~@fontsource',
    replacement: path.resolve(__dirname, 'node_modules/@fontsource')
  },
  {
    find: 'backend',
    replacement: path.resolve(__dirname, './src/backend')
  },
  {
    find: 'frontend',
    replacement: path.resolve(__dirname, './src/frontend')
  },
  {
    find: 'common',
    replacement: path.resolve(__dirname, './src/common')
  }
]

export default defineConfig({
  build: {
    outDir: 'build'
  },
  resolve: {
    alias: aliases
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/backend/main.ts',
        vite: {
          resolve: {
            alias: aliases
          }
        }
      },
      preload: {
        input: {
          preload: path.resolve(__dirname + '/src/backend/preload.ts')
        }
      }
    }),
    svgr()
  ]
})
