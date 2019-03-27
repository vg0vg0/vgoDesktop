const appConfig = require('application-config')('VGO')
const fs = require('fs')
const config = require('../../config')
var request = require("request").defaults({
    strictSSL: false
});
var aes256 = require('./aes256');
const path = require('path')
const PropertiesStore = require('properties-store');
const filename ='params.properties';
class Parameters{

    constructor(){
    }

    getVGoConfigs(key, defaultValue){
        let prop = path.join(config.CONFIG_PATH, filename)
        const pr = require('properties-reader')(prop);
        let vv =  pr.get(key) || defaultValue;
        vv = vv.replace(/\\/g, "");
        return vv;
    }

    syncVGoConfigs(cb){
        const url = 'https://raw.githubusercontent.com/vg0vg0/vgo-config/master/vgo.js'
        request.get(url, (error, response, body) => {
            let key = url.substr(0, 24);
            if (body) {
                var decrypted = aes256.decrypt(key, body);
                let values = JSON.parse(decrypted);
                const properties = new PropertiesStore();
                for (var k in values) {
                    let va = values[k];
                    properties.set(k, va);
                }
                let full =  path.join(config.CONFIG_PATH,filename)
                properties.store(fs.createWriteStream(full),{escapeUnicode : false,encoding :'utf-8'})
            }
        })
    }
}

const parameters = new Parameters()
module.exports = {parameters}
