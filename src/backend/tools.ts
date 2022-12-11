import { WineInstallation } from 'common/types'
import axios from 'axios'
import { writeFileSync } from 'graceful-fs'
import { exec, spawn } from 'child_process'

import { execAsync, getWineFromProton } from './utils'
import { execOptions, heroicToolsPath, isLinux } from './constants'
import { logError, logInfo, LogPrefix, logWarning } from './logger/logger'
import i18next from 'i18next'
import { dirname } from 'path'
import { isOnline } from './online_monitor'
import { showDialogBoxModalAuto } from './dialog/dialog'
import { validWine } from './launcher'

export const Winetricks = {
  download: async () => {
    if (!isLinux) {
      return
    }

    const url =
      'https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks'
    const path = `${heroicToolsPath}/winetricks`

    if (!isOnline()) {
      return
    }

    try {
      logInfo('Downloading Winetricks', { prefix: LogPrefix.WineTricks })
      const res = await axios.get(url, { timeout: 1000 })
      const file = res.data
      writeFileSync(path, file)
      return exec(`chmod +x ${path}`)
    } catch (error) {
      return logWarning(['Error Downloading Winetricks', error], {
        prefix: LogPrefix.WineTricks
      })
    }
  },
  run: async (
    wineVersion: WineInstallation,
    baseWinePrefix: string,
    event: Electron.IpcMainInvokeEvent
  ) => {
    if (!(await validWine(wineVersion))) {
      return
    }

    return new Promise<void>((resolve) => {
      const winetricks = `${heroicToolsPath}/winetricks`

      const { winePrefix, wineBin } = getWineFromProton(
        wineVersion,
        baseWinePrefix
      )

      const winepath = dirname(wineBin)

      const envs = {
        ...process.env,
        WINEPREFIX: winePrefix,
        PATH: `${winepath}:${process.env.PATH}`
      }

      const executeMessages = [] as string[]
      let progressUpdated = false
      const appendMessage = (message: string) => {
        // Don't store more than 100 messages, to not
        // fill the storage and make render still fast
        if (executeMessages.length > 100) {
          executeMessages.shift()
        }
        executeMessages.push(message)
        progressUpdated = true
      }
      const sendProgress = setInterval(() => {
        if (progressUpdated) {
          event.sender.send('progressOfWinetricks', executeMessages)
          progressUpdated = false
        }
      }, 1000)

      // check if winetricks dependencies are installed
      const dependencies = [
        '7z',
        'cabextract',
        'zenity',
        'unzip',
        'curl',
        'wine'
      ]
      dependencies.forEach(async (dependency) => {
        try {
          await execAsync(`which ${dependency}`, execOptions)
        } catch (error) {
          appendMessage(
            `${dependency} not installed! Winetricks might fail to install some packages or even open`
          )
          logWarning(
            [
              `${dependency} not installed! Winetricks might fail to install some packages or even open`
            ],
            {
              prefix: LogPrefix.WineTricks
            }
          )
        }
      })

      logInfo(
        `Running WINEPREFIX='${winePrefix}' PATH='${winepath}':$PATH ${winetricks} --force -q`,
        { prefix: LogPrefix.WineTricks }
      )

      const child = spawn(winetricks, ['--force', '-q'], { env: envs })

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (data: string) => {
        logInfo(data, { prefix: LogPrefix.WineTricks })
        appendMessage(data)
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (data: string) => {
        logError(data, { prefix: LogPrefix.WineTricks })
        appendMessage(data)
      })

      child.on('error', (error) => {
        logError(['Winetricks threw Error:', error], {
          prefix: LogPrefix.WineTricks
        })
        showDialogBoxModalAuto({
          event,
          title: i18next.t('box.error.winetricks.title', 'Winetricks error'),
          message: i18next.t('box.error.winetricks.message', {
            defaultValue:
              'Winetricks returned the following error during execution:{{newLine}}{{error}}',
            newLine: '\n',
            error: `${error}`
          }),
          type: 'ERROR'
        })
        clearInterval(sendProgress)
        resolve()
      })

      child.on('exit', () => {
        clearInterval(sendProgress)
        resolve()
      })

      child.on('close', () => {
        clearInterval(sendProgress)
        resolve()
      })
    })
  }
}
