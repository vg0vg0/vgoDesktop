module.exports = {
  init,
  setModule
}

const electron = require('electron')
const app = electron.app

const log = require('./log')
const menu = require('./menu')
const windows = require('./windows')
const {startGegeCoin} = require('../renderer/vgo/manager')

//const {startTest} = require('../test/gegeTest')

// Messages from the main process, to be sent once the WebTorrent process starts
const messageQueueMainToWebTorrent = []

// Will hold modules injected from the app that will be used on fired
// IPC events.
const modules = {}

function setModule (name, module) {
  modules[name] = module
}

function init () {
  const ipc = electron.ipcMain

  ipc.once('ipcReady', function (e) {
    app.ipcReady = true
    app.emit('ipcReady')
  })

  ipc.on('on-login',(e, ...args) => {
    startGegeCoin(()=>{
      windows.webtorrent.init(...args);
    },args[1])
  })
  
  // ipc.on('start-test',(e, ...args) => {
  //   startTest(...args)
  // })

  ipc.once('ipcReadyWebTorrent', function (e) {
    app.ipcReadyWebTorrent = true
    log('sending %d queued messages from the main win to the webtorrent window',
      messageQueueMainToWebTorrent.length)
    messageQueueMainToWebTorrent.forEach(function (message) {
      windows.webtorrent.send(message.name, ...message.args)
      log('webtorrent: sent queued %s', message.name)
    })
  })

  /**
   * Dialog
   */

  ipc.on('openTorrentFile', () => {
    const dialog = require('./dialog')
    dialog.openTorrentFile()
  })
  ipc.on('openFiles', () => {
    const dialog = require('./dialog')
    dialog.openFiles()
  })
  ipc.on('openMiningDir', () => {
    const dialog = require('./dialog')
    dialog.openMiningDir()
  })

  /**
   * Dock
   */

  ipc.on('setBadge', (e, ...args) => {
    const dock = require('./dock')
    dock.setBadge(...args)
  })
  ipc.on('downloadFinished', (e, ...args) => {
    const dock = require('./dock')
    dock.downloadFinished(...args)
  })

  /**
   * Player Events
   */

  ipc.on('onPlayerOpen', function () {
    const powerSaveBlocker = require('./power-save-blocker')
    const shortcuts = require('./shortcuts')
    const thumbar = require('./thumbar')

    menu.togglePlaybackControls(true)
    powerSaveBlocker.enable()
    shortcuts.enable()
    thumbar.enable()
  })

  ipc.on('onPlayerUpdate', function (e, ...args) {
    const thumbar = require('./thumbar')

    menu.onPlayerUpdate(...args)
    thumbar.onPlayerUpdate(...args)
  })

  ipc.on('onPlayerClose', function () {
    const powerSaveBlocker = require('./power-save-blocker')
    const shortcuts = require('./shortcuts')
    const thumbar = require('./thumbar')

    menu.togglePlaybackControls(false)
    powerSaveBlocker.disable()
    shortcuts.disable()
    thumbar.disable()
  })

  ipc.on('onPlayerPlay', function () {
    const powerSaveBlocker = require('./power-save-blocker')
    const thumbar = require('./thumbar')

    powerSaveBlocker.enable()
    thumbar.onPlayerPlay()
  })

  ipc.on('onPlayerPause', function () {
    const powerSaveBlocker = require('./power-save-blocker')
    const thumbar = require('./thumbar')

    powerSaveBlocker.disable()
    thumbar.onPlayerPause()
  })

  /**
   * Folder Watcher Events
   */

  ipc.on('startFolderWatcher', function () {
    if (!modules['folderWatcher']) {
      log('IPC ERR: folderWatcher module is not defined.')
      return
    }

    modules['folderWatcher'].start()
  })

  ipc.on('stopFolderWatcher', function () {
    if (!modules['folderWatcher']) {
      log('IPC ERR: folderWatcher module is not defined.')
      return
    }

    modules['folderWatcher'].stop()
  })

  /**
   * Shell
   */

  ipc.on('openItem', (e, ...args) => {
    const shell = require('./shell')
    shell.openItem(...args)
  })
  ipc.on('showItemInFolder', (e, ...args) => {
    const shell = require('./shell')
    shell.showItemInFolder(...args)
  })
  ipc.on('moveItemToTrash', (e, ...args) => {
    const shell = require('./shell')
    shell.moveItemToTrash(...args)
  })

  /**
   * File handlers
   */

  ipc.on('setDefaultFileHandler', (e, flag) => {
    const handlers = require('./handlers')

    if (flag) handlers.install()
    else handlers.uninstall()
  })

  /**
   * Auto start on login
   */

  ipc.on('setStartup', (e, flag) => {
    const startup = require('./startup')

    if (flag) startup.install()
    else startup.uninstall()
  })

  /**
   * Windows: Main
   */

  const main = windows.main

  ipc.on('setAspectRatio', (e, ...args) => main.setAspectRatio(...args))
  ipc.on('setBounds', (e, ...args) => main.setBounds(...args))
  ipc.on('setProgress', (e, ...args) => main.setProgress(...args))
  ipc.on('setTitle', (e, ...args) => main.setTitle(...args))
  ipc.on('show', () => main.show())
  ipc.on('toggleFullScreen', (e, ...args) => main.toggleFullScreen(...args))
  ipc.on('setAllowNav', (e, ...args) => menu.setAllowNav(...args))
  
  //go to main after login
  ipc.on('mainHtml',(e, ...args) => main.showMainHtml(...args))
  //go to main after login
  ipc.on('loginHtml',(e, ...args) => main.showLoginHtml(...args))

  //go to test page
  ipc.on('test-page',(e, ...args) => main.showTestHtml(...args))

  //

  ipc.on('live-page',(e, ...args) => main.showLivePage(...args))

  /**
   * External Media Player
   */

  ipc.on('checkForExternalPlayer', function (e, path) {
    const externalPlayer = require('./external-player')

    externalPlayer.checkInstall(path, function (err) {
      windows.main.send('checkForExternalPlayer', !err)
    })
  })

  ipc.on('openExternalPlayer', (e, ...args) => {
    const externalPlayer = require('./external-player')
    const thumbar = require('./thumbar')

    menu.togglePlaybackControls(false)
    thumbar.disable()
    externalPlayer.spawn(...args)
  })

  ipc.on('quitExternalPlayer', () => {
    const externalPlayer = require('./external-player')
    externalPlayer.kill()
  })

  /**
   * Message passing
   */

  const oldEmit = ipc.emit
  ipc.emit = function (name, e, ...args) {
    // Relay messages between the main window and the WebTorrent hidden window
    if (name.startsWith('wt-') && !app.isQuitting) {
      if (e.sender.browserWindowOptions.title === 'webtorrent-hidden-window') {
        // Send message to main window
        windows.main.send(name, ...args)
        log('webtorrent: got %s', name)
      } else if (app.ipcReadyWebTorrent) {
        // Send message to webtorrent window
        windows.webtorrent.send(name, ...args)
        log('webtorrent: sent %s', name)
      } else {
        // Queue message for webtorrent window, it hasn't finished loading yet
        messageQueueMainToWebTorrent.push({
          name: name,
          args: args
        })
        log('webtorrent: queueing %s', name)
      }
      return
    }

    // Emit all other events normally
    oldEmit.call(ipc, name, e, ...args)
  }
}
