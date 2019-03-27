const appConfig = require('application-config')('VGO')
const path = require('path')
const electron = require('electron')
const arch = require('arch')

const APP_NAME = 'VGO'
const APP_TEAM = 'VGO'
const APP_VERSION = require('../package.json').version

const IS_TEST = isTest()
const PORTABLE_PATH = IS_TEST
  ? path.join(process.platform === 'win32' ? 'C:\\Windows\\Temp' : '/tmp', 'GegeTorrentTest')
  : path.join(path.dirname(process.execPath), 'Portable Settings')
const IS_PRODUCTION = isProduction()
const IS_PORTABLE = isPortable()

const UI_HEADER_HEIGHT = 38
const UI_TORRENT_HEIGHT = 100

module.exports = {
  ANNOUNCEMENT_URL: 'http://www.vg0vg0.com/desktop/announcement',
  AUTO_UPDATE_URL: 'http://www.vg0vg0.com/desktop/update',
  CRASH_REPORT_URL: 'http://www.vg0vg0.com/desktop/crash-report',
  TELEMETRY_URL: 'http://www.vg0vg0.com/desktop/telemetry',

  APP_COPYRIGHT: 'Copyright © ' + APP_TEAM,
  APP_FILE_ICON: path.join(__dirname, '..', 'static', 'WebTorrentFile'),
  APP_ICON: path.join(__dirname, '..', 'static', 'vgo'),
  APP_NAME: APP_NAME,
  APP_TEAM: APP_TEAM,
  APP_VERSION: APP_VERSION,
  APP_WINDOW_TITLE: 'VGo Wallet(eache resource has a value)',
  CONFIG_PATH: getConfigPath(),

  DEFAULT_TORRENTS: [],

  DELAYED_INIT: 3000 /* 3 seconds */,

  DEFAULT_DOWNLOAD_PATH: getDefaultDownloadPath(),

  GITHUB_URL: 'https://github.com/vg0vg0/vgoDesktop',
  GITHUB_URL_ISSUES: 'https://github.com/vg0vg0/vgoDesktop/issues',
  GITHUB_URL_RAW: 'https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master',
  GITHUB_URL_WEB : 'https://vg0vg0.github.io',
  GITHUB_URL_ANDROID : 'https://github.com/vg0vg0/vgoAndroid/',
  GITHUB_URL_IOS : 'https://github.com/vg0vg0/vgoIOS/',
  
  HOME_PAGE_URL: 'http://www.vg0vg0.com',

  IS_PORTABLE: IS_PORTABLE,
  IS_PRODUCTION: IS_PRODUCTION,
  IS_TEST: IS_TEST,

  OS_SYSARCH: arch() === 'x64' ? 'x64' : 'ia32',

  POSTER_PATH: path.join(getConfigPath(), 'Posters'),
  MINING_PATH: path.join(getConfigPath(), 'Shares'),
  ROOT_PATH: path.join(__dirname, '..'),
  STATIC_PATH: path.join(__dirname, '..', 'static'),
  TORRENT_PATH: path.join(getConfigPath(), 'Torrents'),
  ACCOUNT_CACHE: getAccoutCache(),
  RTCCONFIG_CACHE: getRTcCache(),


  WINDOW_ABOUT: 'file://' + path.join(__dirname, '..', 'static', 'about.html'),
  WINDOW_MAIN: 'file://' + path.join(__dirname, '..', 'static', 'main.html'),
  WINDOW_LOGIN: 'file://' + path.join(__dirname, '..', 'static', 'login.html'),
  WINDOW_WEBTORRENT: 'file://' + path.join(__dirname, '..', 'static', 'webtorrent.html'),
  WINDOW_TEST: 'file://' + path.join(__dirname, '..', 'test', 'test.html'),
  WINDOW_LIVE: 'file://' + path.join(__dirname, '..', 'live', 'live.html'),

  WINDOW_INITIAL_BOUNDS: {
    width: 900,
    height: UI_HEADER_HEIGHT + (UI_TORRENT_HEIGHT * 6) // header + 6 torrents
  },
  WINDOW_MIN_HEIGHT: 800, // header + 2 torrents
  WINDOW_MIN_WIDTH: 900,

  UI_HEADER_HEIGHT: UI_HEADER_HEIGHT,
  UI_TORRENT_HEIGHT: UI_TORRENT_HEIGHT,
  get
}

function get(key, defaultValue) {
  try {
    let prop = path.join(getConfigPath(), 'vgo.properties')
    const pr = require('properties-reader')(prop);
    return pr.get(key) || defaultValue;
  } catch (e) {
    console.log('get custom properties err ' + e);
    return defaultValue;
  }
}

function getAccoutCache() {
  return path.join(getConfigPath(), 'account.cache')
}

function getRTcCache() {
  return path.join(getConfigPath(), 'rtc.cache')
}

function getConfigPath() {
  if (IS_PORTABLE) {
    return PORTABLE_PATH
  } else {
    return path.dirname(appConfig.filePath)
  }
}

function getDefaultDownloadPath() {
  if (IS_PORTABLE) {
    return path.join(getConfigPath(), 'Downloads')
  } else {
    return getPath('downloads')
  }
}

function getPath(key) {
  if (!process.versions.electron) {
    // Node.js process
    return ''
  } else if (process.type === 'renderer') {
    // Electron renderer process
    return electron.remote.app.getPath(key)
  } else {
    // Electron main process
    return electron.app.getPath(key)
  }
}

function isTest() {
  return process.env.NODE_ENV === 'test'
}

function isPortable() {
  if (IS_TEST) {
    return true
  }

  if (process.platform !== 'win32' || !IS_PRODUCTION) {
    // Fast path: Non-Windows platforms should not check for path on disk
    return false
  }

  const fs = require('fs')

  try {
    // This line throws if the "Portable Settings" folder does not exist, and does
    // nothing otherwise.
    fs.accessSync(PORTABLE_PATH, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

function isProduction() {
  if (!process.versions.electron) {
    // Node.js process
    return false
  }
  if (process.platform === 'darwin') {
    return !/\/Electron\.app\//.test(process.execPath)
  }
  if (process.platform === 'win32') {
    return !/\\electron\.exe$/.test(process.execPath)
  }
  if (process.platform === 'linux') {
    return !/\/electron$/.test(process.execPath)
  }
}
