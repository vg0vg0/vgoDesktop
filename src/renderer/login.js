const {electron,ipcRenderer} = require('electron')

module.exports =  {
    login
}

/*
function login(){
    var accountId = "123123";
    var peerId = '1234567890123456789012345678901234567890';
    var peerToken = 'thisispeertoken';
    var peerSignature ='thisissignature';
    ipcRenderer.send('on-login',peerId,peerToken,peerSignature)
    ipcRenderer.send('mainHtml',accountId)
} 
*/
