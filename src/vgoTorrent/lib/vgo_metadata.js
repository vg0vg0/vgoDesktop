var bencode = require('bencode')
var Buffer = require('safe-buffer').Buffer
var debug = require('debug')('vgo_metadata')
var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')
const {verifyToken,calcToken} = require('./../../renderer/vgo/manager')
var MAX_METADATA_SIZE = 5000000 // 5MB

module.exports = function (myPeerId,secretHex) {
  inherits(vgoMetadata, EventEmitter)

  function vgoMetadata (wire) {
    EventEmitter.call(this)
    this._secretHex = secretHex
    this._myPeerId = myPeerId;
    this._wire = wire
    this._metadataSize = null
    this._remainingRejects = null // how many reject messages to tolerate before quitting
    this._fetching = true
    this._timeout = setTimeout(() => {
      this._wire.destroy()
    }, 10000);
  }

  // Name of the bittorrent-protocol extension
  vgoMetadata.prototype.name = 'vgo_metadata'

  vgoMetadata.prototype.onHandshake = function (infoHash, peerId, extensions) {
    debug('onHandshake ' + infoHash + ' ' + peerId)
    this._infoHash = infoHash
    this._peerId = peerId;
  }

  vgoMetadata.prototype.onExtendedHandshake = function (handshake) {
    debug('onExtendedHandshake ' + handshake)
    if (!handshake.m || !handshake.m.vgo_metadata) {
      return this.emit('warning', new Error('Peer does not support vgo_metadata'))
    }
    if (!handshake.metadata_size) {
      return this.emit('warning', new Error('Peer does not have metadata'))
    }
    if (typeof handshake.metadata_size !== 'number' ||
        MAX_METADATA_SIZE < handshake.metadata_size ||
        handshake.metadata_size <= 0) {
      return this.emit('warning', new Error('Peer gave invalid metadata size'))
    }

    this._metadataSize = handshake.metadata_size
    this._remainingRejects = 2

    if (this._fetching) {
      this._requestToken()
    }
  }

  vgoMetadata.prototype.onMessage = function (buf) {

    var dict, trailer
    try {
      var str = buf.toString()
      debug('onMessage ' + str)
      var trailerIndex = str.indexOf('ee') + 2
      dict = bencode.decode(str.substring(0, trailerIndex))
      trailer = buf.slice(trailerIndex)
    } catch (err) {
      // drop invalid messages
      return
    }

    switch (dict.msg_type) {
      case 0:
        // vgo_metadata request (from peer)
        // example: { 'msg_type': 0, 'piece': 0 }
        this._onRequest()
        break
      case 1:
        // vgo_metadata data (in response to our request)
        // example: { 'msg_type': 1, 'piece': 0, 'total_size': 3425 }
        this._onData(trailer)
        break
      case 2:
        // vgo_metadata reject (peer doesn't have piece we requested)
        // { 'msg_type': 2, 'piece': 0 }
        this._onReject()
        break
    }
  }

  /**
   * Ask the peer to send metadata.
   * @public
   */
  vgoMetadata.prototype.fetch = function () {
    debug('fetch')
    this._fetching = true
    this._requestToken()
  }

  /**
   * Stop asking the peer to send metadata.
   * @public
   */
  vgoMetadata.prototype.cancel = function () {
    debug('cancel')
    this._fetching = false
  }

  vgoMetadata.prototype._send = function (dict, trailer) {
    debug('_send')
    var buf = bencode.encode(dict)
    if (Buffer.isBuffer(trailer)) {
      buf = Buffer.concat([buf, trailer])
    }
    this._wire.extended('vgo_metadata', buf)
  }

  vgoMetadata.prototype._request = function () {
    this._send({ msg_type: 0 })
  }

  vgoMetadata.prototype._data = function (buf) {
    var msg = { msg_type: 1 }
    this._send(msg, buf)
  }

  vgoMetadata.prototype._reject = function () {
    this._send({ msg_type: 2 })
  }


  vgoMetadata.prototype._onRequest = function () {
    calcToken(this._secretHex,this._peerId,this._infoHash,(tokenHex)=>{
      let buf = new Buffer(tokenHex,'hex')
      this._data(buf)
    })
  }

  vgoMetadata.prototype._onData = function (buf) {
    const tokenHex =  buf.toString('hex')
    debug('_onData ' + tokenHex)
    this._checkDone(tokenHex)
  }

  vgoMetadata.prototype._onReject = function () {
    if (this._remainingRejects > 0 && this._fetching) {
      // If we haven't been rejected too much, then try to request the piece again
      this._request()
      this._remainingRejects -= 1
    } else {
      this.emit('warning', new Error('Peer sent "reject" too much'))
    }
  }
  
  vgoMetadata.prototype._requestToken = function () {
      debug('_requestToken')
      this._request()
  }

  vgoMetadata.prototype._checkDone = function (tokenHex) {
    //verify token
    debug('checking token hex ' + tokenHex)
    verifyToken(this._myPeerId,this._peerId,tokenHex,this._infoHash,(ok)=>{
      if(!ok){
        debug('verifyToken failed.destory wire')
        this._wire.destroy()
      }
      clearTimeout(this._timeout);
    })
  }

  return vgoMetadata
}
