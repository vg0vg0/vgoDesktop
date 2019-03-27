const React = require('react')
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
const ActionPayment = require('material-ui/svg-icons/action/payment').default
const TextField = require('material-ui/TextField').default
const FlatButton = require('material-ui/FlatButton').default
const { dispatcher } = require('../lib/dispatcher')
const ContentSend = require('material-ui/svg-icons/content/send').default
var i18n = new(require('../../renderer/i18n'))

class WalletPage extends React.Component {
    constructor(props) {
        super(props)
        this.state = this.props.state;
        this.state.sendTransaction = { rsid: '', pk: '', amount: 0, fee: 1, deadline: 5 };
        this.state.msg = ''
    }

    render() {
        return (<div>
            {this.renderButtons()}
            <Divider inset={true} />
        </div>)
    }

    setId(_, rsid) {
        this.state.sendTransaction.rsid = rsid;
    }
    setPK(_, pk) {
        this.state.sendTransaction.pk = pk;
    }
    setAmount(_, amount) {
        this.state.sendTransaction.amount = amount;
    }
    setFee(_, fee) {
        this.state.sendTransaction.fee = fee;
    }
    setDeadline(_, deadline) {
        this.state.sendTransaction.deadline = deadline;
    }


    onSendvgo(ok) {
        if (ok)
            this.state.msg = i18n.show('transaction_ok');
        else
            this.state.msg = i18n.show('err');
    }

    renderButtons() {
        return (<div>
            <List>
                <ListItem insetChildren={true}>{i18n.show('vgo_transfer')} :</ListItem>
                <div class="margin-left20">
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('account_id')}
                        multiLine
                        rows={1}
                        rowsMax={10}
                        onChange={this.setId.bind(this)} />
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('public_key')}
                        multiLine
                        rows={1}
                        onChange={this.setPK.bind(this)}
                        rowsMax={10} />
                </div>
                <div>
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('amount')}
                        multiLine
                        rows={1}
                        onChange={this.setAmount.bind(this)}
                        rowsMax={10} />
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('fee')}
                        multiLine
                        rows={1}
                        onChange={this.setFee.bind(this)}
                        rowsMax={10} />
                    <TextField
                        className='torrent-comment control'
                        hintText={i18n.show('deadline')}
                        multiLine
                        rows={1}
                        onChange={this.setDeadline.bind(this)}
                        rowsMax={10} />
                </div>
                <div>
                    <i>{this.state.msg}</i>
                </div>
                <div>
                    <FlatButton
                        label={i18n.show('send_vgo')}
                        onClick={dispatcher('sendvgo', this.state.sendTransaction, this.onSendvgo)}><ContentSend /></FlatButton>
                </div>
            </List></div>);
    }


}

module.exports = WalletPage