const path = require("path")
const electron = require('electron')
const fs = require('fs');
let loadedLanguage;
let app = electron.app ? electron.app : electron.remote.app

let LOCALE_DIR = path.join(__dirname, '..', '..', '..', 'locales')

module.exports = i18n;

function i18n() {
    let prefix = app.getLocale().substring(0,2);
   // console.log("app.getLocale() " + prefix);
    if (fs.existsSync(path.join(LOCALE_DIR, prefix + '.json'))) {
        loadedLanguage = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, prefix + '.json'), 'utf8'))
    }
    else {
        loadedLanguage = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'en.json'), 'utf8'))
    }
}

i18n.prototype.show = function (phrase) {
    let translation = loadedLanguage[phrase]
    if (translation === undefined) {
        translation = phrase
    }
    return translation
}