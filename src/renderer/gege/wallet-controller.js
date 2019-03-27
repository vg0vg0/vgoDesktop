const electron = require('electron')
const { dispatcher } = require('../lib/dispatcher')
const config = require('../../config')
const ipcRenderer = electron.ipcRenderer
var request = require("request");


module.exports = class WalletController {

    constructor(state) {
        this.state = state
    }

    showWallet() {
        console.log('show showWallet ');
        this.state.location.go({
            url: 'wallet'
        })
    }

}   