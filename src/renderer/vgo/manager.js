var request = require("request").defaults({strictSSL: false});
const exec = require('child_process').exec;
const parallel = require('run-parallel')
var fs = require('fs')
var path = require('path')
const appConfig = require('application-config')('VGO')
var host = 'https://127.0.0.1:12129'
const {signBytes} = require('./utils')
const config = require('../../config')

if (global.vgo_AUTH_SERVER) {
    host = global.vgo_AUTH_SERVER;
  }

ACCOUNT_CACHE = path.join(__dirname, 'account.cache')

function vgoRequest(url, cb) {
    //console.log("vgoRequest " + url);
    request.post(url, cb);
}

function sendvgoCoin(secretHex, tran, cb) {
    //console.log(tran);
    let url = host + "/vgo?action=transaction&type=transfer&fee=" + tran.fee
        + "&secretHex=" + secretHex + "&timeStamp=" + Date.now() + "&deadline=" + tran.deadline + "&publicKey=" + tran.pk
        + "&recipientId=" + tran.rsid + "&price=" + tran.amount
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function addvgoServer(server, cb) {
    url = host + "/vgo?action=addPeer&host=" + server.host + "&port=" + server.port
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function purchaseGGResource(secretHex, resource, cb) {
    //console.log(resource)
    let url = host + "/vgo?action=transaction&type=buy&fee=" + resource.fee + "&secretHex=" + secretHex + "&timeStamp=" + Date.now() + "&deadline=" + resource.deadline + "&resId=" + resource.id
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function loadUnconfirmed(page, cb) {
    var url = host + '/vgo?action=unconfirmedList&page=' + page + '&size=10'
    vgoRequest(url, function (error, response, body) {
        //console.log("loadUnconfirmed=" + body);
        if (body) {
            var list = JSON.parse(body)
            if (list.count && list.count > 0) {
                cb(list.transactions);
                return;
            }
        }
        cb(null);
    })
}

function loadBlocks(page, cb) {
    var url = host + '/vgo?action=blockList&page=' + page + '&size=10'
    vgoRequest(url, function (error, response, body) {
        //console.log("loadBlocks=" + body);
        if (body) {
            var list = JSON.parse(body)
            if (list) {
                cb(list);
                return;
            }
        }
        cb(null);
    })
}

function loadvgoResources(cb, page, tabIndex, size, query, account) {

    var myState = this.state;

    if (!query)
        query = this.state.query;

    var url = host + '/vgo?action=listResource&page=' + page + '&size=' + size + '&tabIndex=' + tabIndex;
    if (query)
        url = url + '&query=' + Buffer.from(query).toString('hex');
    if (account)
        url = url + "&account=" + account;

    vgoRequest(url, function (error, response, body) {
        //console.log("listResource=" + body);
        if (body) {
            var list = JSON.parse(body)
            if (list) {
                cb(list);
                return;
            }
        }
        cb(null);
    })
}


function publishGGService(secretHex, service, cb) {
    let type = 'publish';
    let fee = service.fee;
    let deadline = service.deadline;
    let price = service.price;
    let tags = service.comment;

    tags = Buffer.from(tags).toString('hex')

    let url = host + "/vgo?action=transaction&type=" + type + "&secretHex=" + secretHex + "&timeStamp=" + Date.now() + "&fee=" + fee + "&deadline=" + deadline + "&price=" + price +
        "&tags=" + tags;
    //+"&magnetURI=" + magnetURI  + "&path=" + name;
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function shareResource(opt, resource, cb) {
    //console.log(opt)
    doShareTransaction(opt, resource, cb)
}

function preShareResource(opt, cb) {
    //save price etc.
    //check balance
    //check exist
    cb(true);
}

function getFreevgo(pk, secretHex, phone, cb) {
    let url = host + "/vgo?action=freevgo&phone=" + phone + "&secretHex=" + secretHex + "&pk=" + pk;

    vgoRequest(url, function (error, response, body) {
        //console.log(body);
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}


function getStatus(cb) {
    let url = host + "/vgo?action=status";
    vgoRequest(url, function (error, response, body) {
        //console.log("body=" + body);
        if (body) {
            var status = JSON.parse(body);
            cb(status);
        } else
            cb(null)
    });
}

function getResourceInfo(resId, cb) {
    let url = host + "/vgo?action=resinfo&resId=" + resId
    vgoRequest(url, function (error, response, body) {
        //console.log("body=" + body);
        if (body) {
            var status = JSON.parse(body);
            //console.log("status=" + status.toString());
            var resource = status.resource;
            //console.log("resource=" + resource.toString());
            cb(resource);
        } else
            cb(null)
    });
}




function deleteResource(secretHex, resId, cb) {
    let type = 'delete'
    let deadline = 5
    let fee = 1;

    let url = host + "/vgo?action=transaction&type=" +
        type + "&secretHex=" + secretHex + "&timeStamp=" + Date.now() + "&fee=" + fee + "&deadline=" + deadline + "&resId=" + resId
    //+"&magnetURI=" + magnetURI  + "&path=" + name;
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, err);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function getAccountInfo(rsIdOrPkHex, cb){
    var url = host + "/vgo?action=account&rsIdOrPkHex=" + rsIdOrPkHex;
    vgoRequest(url, function (error, response, body) {
        //console.log("body=" + body);
        if (body) {
            var account = JSON.parse(body);
            if (account && account.exist)
                cb(account);
            else
                cb(null);
        } else
            cb(null)
    });
}

function calcToken(secHex,peerId,infoHash,cb){
    let time = new Date().getTime();
    time = time - time % (1000 * 60 * 60);
    let data = peerId + infoHash + time;
    let sec = Buffer.from(secHex,'hex').toString()
    let sig = signBytes(data,sec)
    cb(sig)
}

function verifyToken(myPeerId,peerId,token,infoHash,cb){
    let url = host + "/vgo?action=verifyToken&token=" + token + "&peerId=" + peerId + '&infoHash=' + infoHash + '&myPeerId=' + myPeerId;
    vgoRequest(url, (function (error, res, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    }).bind(this));
}

function verifyPurchase(infoHash, peerId, cb) {
    let url = host + "/vgo?action=verifyDownload&resId=" + infoHash + "&peerId=" + peerId;
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}


function doShareTransaction(opt, resource, cb) {

    let type = 'sell';
    let fee = resource.fee;
    let deadline = resource.deadline;
    let price = resource.price;
    let resId = opt.infoHash;
    let tags = resource.comment;
    let magnetURI = opt.magnetURI;
    let resName = opt.name
    let path = opt.path
    let files = opt.files
    let secretHex = resource.secretHex;

    const totalBytes = opt.files
    .map((f) => f.length)
    .reduce((a, b) => a + b, 0)


    resName = Buffer.from(resName).toString('hex')
    tags = Buffer.from(tags).toString('hex')

    let url = host + "/vgo?action=transaction&type=" + type + "&timeStamp=" + Date.now() + "&fee=" + fee + "&deadline=" + deadline + "&price=" + price +
        "&resId=" + resId + "&secretHex=" + secretHex + "&tags=" + tags + "&resName=" + resName  + "&length=" + totalBytes;
    //+"&magnetURI=" + magnetURI  + "&path=" + name;
    vgoRequest(url, function (error, response, body) {
        if (error) {
            cb(false, error);
        } else {
            if (body) {
                var body = JSON.parse(body)
                cb(body.ok)
            } else {
                cb(false, 'no response');
            }
        }
    });
}

function execCmd(cb, userSecHex) {
    const appPath = config.IS_PRODUCTION ? path.dirname(process.execPath): config.ROOT_PATH
    let java = path.join(appPath,'jre','jre1.8.0_131','bin','java')
    var cmd = java + ' -Dfile.encoding=UTF-8 -jar vgo.jar 19199 ' + userSecHex + " ssl 12129";
    var child = exec(cmd,
        function (error, stdout, stderr) {
            console.log('Output -> ' + stdout);
            if (error !== null) {
                console.log("Error -> " + error);
            }
            if (stderr !== null) {
                console.log("stderr -> " + stderr);
            }
            cb();
        })
}

function checkOnline(cb, ...args) {
    vgoRequest(host, function (error, response, body) {
        if (error) {
            cb(false)
        } else {
            cb(true);
        }
    });
}

function startGegeCoin(cb, userSecHex) {
    checkOnline((online) => {
        //console.log("online=" + online)
        parallel([function () {
            if (!online) {
                execCmd(cb, userSecHex);
            }
        }, function () {
            cb();
        }], function (err, results) {
            // the results array will equal ['one','two'] even though
            // the second function had a shorter timeout.
        })
    })
}

function quitGegeCoin() {
    vgoRequest(host + "/vgo?action=exit", function (error, response, body) {
        //console.log(body);
    });
}

class VgoDB {

    constructor() {
        this.AccountSchema = {
            name: 'Account',
            properties: {
                secret: 'string',
                pk: 'string',
                rsId: 'string',
                balance: { type: 'int', default: 0 },
            }
        };
    }

    saveRtcConfig(cache, rtcconfig, cb) {
        appConfig.filePath = cache;
        let data = { rtcconfig: rtcconfig }
        appConfig.write(data, (err) => {
            if (err) {
                cb(false)
            } else {
                cb(true)
            }
        })
    }

    loadRtcConfig(cacheFile, cb) {
        let rtcConfig = {
            "iceServers": [
                { "urls": "stun:stun2.l.google.com:19302" },
                { "urls": "stun:stun3.l.google.com:19302" },
                {
                    "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
                    "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
                    "urls": "turn:global.turn.twilio.com:3478?transport=udp"
                },
                {
                    "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
                    "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
                    "urls": "turn:global.turn.twilio.com:3478?transport=tcp"
                },
                {
                    "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
                    "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
                    "urls": "turn:global.turn.twilio.com:443?transport=tcp"
                }
            ]
        };

        appConfig.filePath = cacheFile;
        appConfig.read(function (err, data) {
            if (err) {
                cb(rtcConfig)
            } else {
                if (data.rtcconfig) {
                    cb(data.rtcconfig)
                } else {
                    cb(rtcConfig)
                }
            }
        })
        //cb(rtcConfig);
    }


    saveAccount(cacheFile, userSecHex, pubHex, rsId, peerId, cb) {
        this.loadLastAccount(cacheFile, (last) => {
            if (last && last.pk === pubHex) {
                //console.log('account already exist.no need to save');
                cb(true);
            } else {
                this.createAccount(cacheFile, userSecHex, pubHex, rsId, peerId, cb)
            }
        })
    }

    createAccount(cacheFile, userSecHex, pubHex, rsId, peerId, cb) {
        //console.log('createAccount ' + cacheFile);
        let account = {
            secret: '',
            pk: pubHex,
            rsId: rsId,
            balance: 0,
        };
        appConfig.filePath = cacheFile;
        let data = { account: account };
        //
        appConfig.write(data, (err) => {
            if (err) {
                cb(false)
            } else {
                cb(true)
            }
        })
        /*
        Realm.open({ schema: [this.AccountSchema] })
            .then(realm => {
                // Create Realm objects and write to local storage
                realm.write(() => {
                    const myAccount = realm.create('Account', {
                        secret: userSecHex,
                        pk: pubHex,
                        rsId: rsId,
                        balance: 0,
                    });
                });
                cb(true);
            })
            .catch(error => {
                //console.log(error);
                cb(false);
            });
            */
    }

    loadLastAccount(cacheFile, cb) {
        //console.log('loadLastAccount ' + cacheFile);
        appConfig.filePath = cacheFile;
        appConfig.read(function (err, data) {
            if (err) {
                cb(null)
            } else {
                if (data.account) {
                    cb(data.account)
                } else {
                    cb(null)
                }
            }
        })
        /*
        Realm.open({ schema: [this.AccountSchema] })
            .then(realm => {
                const cars = realm.objects('Account');
                ////console.log(cars)
                cb(cars[cars.length -1]);
            })
            .catch(error => {
                //console.log(error);
                cb(null);
            });
            */
    }


    loadAccounts(cb) {
        /*
        Realm.open({ schema: [this.AccountSchema] })
            .then(realm => {
                const cars = realm.objects('Account');
                //console.log(cars)
                cb(cars);
            })
            .catch(error => {
                //console.log(error);
                cb(null);
            });
            */
    }
}


function checkExpire(cb) {
    let expire = new Date('Jan 01 2020');
    let now = new Date();
    if (now > expire) {
        cb()
        return true;
    }
    return false;
}

const vgoDB = new VgoDB();

module.exports = {
    verifyPurchase,
    verifyToken,
    calcToken,
    shareResource,
    preShareResource,
    quitGegeCoin,
    startGegeCoin,
    getAccountInfo,
    deleteResource,
    getResourceInfo,
    getFreevgo,
    loadvgoResources,
    purchaseGGResource,
    sendvgoCoin,
    getStatus,
    loadBlocks,
    loadUnconfirmed,
    publishGGService,
    addvgoServer,
    checkExpire,
    checkOnline,
    vgoDB
}