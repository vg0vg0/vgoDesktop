const React = require('react')
const { dispatcher } = require('../lib/dispatcher')
const TextField = require('material-ui/TextField').default
const FlatButton = require('material-ui/FlatButton').default

const ActionPayment = require('material-ui/svg-icons/action/payment').default
const ContentSend = require('material-ui/svg-icons/content/send').default
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
var i18n = new (require('../../renderer/i18n'))
const gege = new (require('../gege/gegev-controller'))
const { vgoDB } = require('../vgo/manager')
const config = require('../../config')

class ServicePage extends React.Component {
    constructor(props) {
        super(props)
        this.state = this.props.state;
        // this.state.resource = { fee: 1, deadline: 5, resId: this.props.state.resId };
        this.server = { host: '', port: '1001', ssl: false }
        this.state.message = i18n.show('');
        this.rtcConfig = {};
    }

    onPurchaseDone(ok) {
        console.log('on server ok=' + ok);
        this.state.message = i18n.show('server_ok');
    }

    setHost(_, host) {
        this.server.host = host;
    }

    setPort(_, port) {
        this.server.port = port;
    }

    setRtcConfig(_, rtcConfig) {
        this.rtcConfig = rtcConfig;
    }
    submit() {
        gege.addServer(this.server, this.onPurchaseDone)
    }

    saveRTC() {
        let conf = JSON.parse(this.rtcConfig);
        vgoDB.saveRtcConfig(config.RTCCONFIG_CACHE,conf,(ok)=>{
            this.state.message = ok;
        })
    }

    render() {
        return (<div>
            <List>
                <ListItem insetChildren={true}>{i18n.show('add_server')}</ListItem>
            </List>
            <Divider inset={true} />
            <List>
                <ListItem insetChildren={true}>
                    <label>Server:</label>
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('host')}
                        rows={1}
                        rowsMax={10}
                        onChange={this.setHost.bind(this)} />
                </ListItem>
                <ListItem insetChildren={true}>
                    <div key='comment' className='torrent-attribute'>
                        <label>{i18n.show('port')}:</label>
                        <TextField
                            className='torrent-comment control'
                            hintText={i18n.show('port')}
                            multiLine
                            rows={1}
                            rowsMax={10}
                            onChange={this.setPort.bind(this)} />
                    </div>
                </ListItem>
            </List>
            <Divider inset={true} />
            <List>
                <ListItem insetChildren={true}> {this.state.message}</ListItem>
                <ListItem insetChildren={true}>
                    <FlatButton
                        label={i18n.show('add_server')}
                        onClick={() => this.submit()}><ActionPayment /> </FlatButton></ListItem>
            </List>
        </div>)
    }

}
module.exports = ServicePage