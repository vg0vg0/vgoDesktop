module.exports = {
  openSeedFile,
  openSeedDirectory,
  openTorrentFile,
  openTorrentAddress,
  openMiningDir,
  openFiles
}

const electron = require('electron')

const log = require('./log')
const windows = require('./windows')

var i18n = new (require('../renderer/i18n'))

/**
 * Show open dialog to create a single-file torrent.
 */
function openSeedFile() {
  if (!windows.main.win) return
  log('openSeedFile')
  const opts = {
    title: 'Select a file for the torrent.',
    properties: ['openFile']
  }
  showOpenSeed(opts)
}

/*
 * Show open dialog to create a single-file or single-directory torrent. On
 * Windows and Linux, open dialogs are for files *or* directories only, not both,
 * so this function shows a directory dialog on those platforms.
 */
function openSeedDirectory() {
  if (!windows.main.win) return
  log('openSeedDirectory')
  const opts = process.platform === 'darwin'
    ? {
      title: 'Select a file or folder for the torrent.',
      properties: ['openFile', 'openDirectory']
    }
    : {
      title: 'Select a folder for the torrent.',
      properties: ['openDirectory']
    }
  showOpenSeed(opts)
}

/*
 * Show flexible open dialog that supports selecting .torrent files to add, or
 * a file or folder to create a single-file or single-directory torrent.
 */
function openFiles() {
  if (!windows.main.win) return
  log('openFiles')
  const opts = process.platform === 'darwin'
    ? {
      title: i18n.show('select_dir_share'),
      properties: ['openFile', 'openDirectory']
    }
    : {
      title: i18n.show('select_file_share_title'),
      properties: ['openFile']
    }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('onOpen', selectedPaths)
  })
}

function openMiningDir(cb){

  if (!windows.main.win) return
  log('openFiles')
  const opts = {
    title: i18n.show('select_mining_dir'),
    properties: ['openDirectory']
  }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    log('onMiningDir' + selectedPaths);
    windows.main.dispatch('onMiningDir', selectedPaths[0])
  })
}


function account(accoutId) {
  console.log("show account dialog." + accoutId);
}


/*
 * Show open dialog to open a .torrent file.
 */
function openTorrentFile() {
  if (!windows.main.win) return
  log('openTorrentFile')
  const opts = {
    title: 'Select a .torrent file.',
    filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
    properties: ['openFile', 'multiSelections']
  }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    selectedPaths.forEach(function (selectedPath) {
      windows.main.dispatch('addTorrent', selectedPath)
    })
  })
}

/*
 * Show modal dialog to open a torrent URL (magnet uri, http torrent link, etc.)
 */
function openTorrentAddress() {
  log('openTorrentAddress')
  windows.main.dispatch('openTorrentAddress')
}

/**
 * Dialogs on do not show a title on Mac, so the window title is used instead.
 */
function setTitle(title) {
  if (process.platform === 'darwin') {
    windows.main.dispatch('setTitle', title)
  }
}

function resetTitle() {
  windows.main.dispatch('resetTitle')
}

/**
 * Pops up an Open File dialog with the given options.
 * After the user selects files / folders, shows the Create Torrent page.
 */
function showOpenSeed(opts) {
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('showCreateTorrent', selectedPaths)
  })
}
