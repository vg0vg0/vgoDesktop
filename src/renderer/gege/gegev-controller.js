const { loadvgoResources, sendvgoCoin, purchaseGGResource, getStatus, loadBlocks, loadUnconfirmed,
     publishGGService, addvgoServer, checkOnline, startGegeCoin, quitGegeCoin } = require('../vgo/manager')
const {remote} = require('electron')

module.exports = class GegevController {

    constructor(state) {
        this.state = state
    }

    purchaseGGResource(infoHash, cb) {
        let userSecHex = remote.getGlobal('vgoAccount').userSecHex;
        purchaseGGResource(userSecHex,infoHash, cb);
    }

    publishService(usersecHex,service, cb) {
        publishGGService(usersecHex,service, cb);
    }

    sendvgo(tran, cb) {
        let userSecHex = remote.getGlobal('vgoAccount').userSecHex;
        sendvgoCoin(userSecHex,tran, cb);
    }

    gotoServicePage() {
        this.state.location.go({
            url: 'service-page'
        })
    }

    showServerPage() {
        state.location.go({
            url: 'servers'
        })
    }

    addServer(server, cb) {
        addvgoServer(server, cb);
    }

    showUnconfirmedList(page) {
        loadUnconfirmed(page, (list) => {
            if (list) {
                state.unconfirmed = list;
                state.location.go({
                    url: 'unconfirmedList'
                })
            } else {
                console.log('unconfirmedList err')
            }
        })
    }

    showBlockList(page) {
        loadBlocks(page, (list) => {
            if (list) {
                state.blocks = list;
                state.location.go({
                    url: 'blockList'
                })
            } else {
                console.log('loadBlocks err')
            }
        })
    }

    reboot(userSecHex) {
        // console.log("reboot " + userSecHex)
        quitGegeCoin();
        setTimeout(() => {
            startGegeCoin(() => {
                console.log('reboot done');
            }, userSecHex);
        }, 50000);
    }

    updateStatus() {
        console.log("getStatus...")
        getStatus((status) => {
            if (status) {
                this.state.status = status;
            } else {
                checkOnline((online) => {
                    if (!online) {
                        console.log('vgo is offline.please restart')
                    }
                })
            }
        })
    }

    loadServieResources(page, account, cbb) {
        let cb = function (list) {
            //console.log("resource list=" + list);
            if (list) {
                cbb(list)
            }
        };
        loadvgoResources(cb, page, -1, 8, null, account);
    }

    // Shows a modal saying that we have an update
    loadResources(page, query, tabIndex, account) {
        var myState = this.state;
        let cb = function (list) {
            console.log("resource list=" + list + " page=" + page);
            if (list) {
                //TODO clear array
                myState.resources = [];
                list.map((res) => {
                    let tor = {
                        status: 'paused',
                        infoHash: res.id,
                        name: res.tags,
                        torrentKey: res.id,
                        owner: res.owner,
                        price: res.price,
                        height: res.height,
                        purchased: res.purchased,
                        isService: res.isService
                    }
                    const ts = this.state.saved.torrents.find((ts) => {
                        return ts.infoHash === res.id
                    })
                    if (ts) {
                        console.log('add exist' + res)
                        myState.resources.push(ts);
                    } else {
                        myState.resources.push(tor);
                    }
                })
            }
        };
        loadvgoResources(cb, page, tabIndex, 8, query, account);
    }
}
