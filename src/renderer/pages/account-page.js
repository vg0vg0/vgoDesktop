const React = require('react')
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
var i18n = new (require('../../renderer/i18n'))
const { clipboard } = require('electron')
const FlatButton = require('material-ui/FlatButton').default
const ContentSend = require('material-ui/svg-icons/content/send').default


class AccountPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = this.props.state;
  }
  copyAccountInfo() {
    let info = i18n.show('account_id') + '=' + this.state.account.rsId + "," + i18n.show('public_key') + '=' + this.state.account.pk
    clipboard.writeText(info);
  }
  render() {
    return (<div>
      <List>
        <ListItem insetChildren={true}>{i18n.show('vgo_account_info')}</ListItem>
        <ListItem insetChildren={true}>{i18n.show('account_id')} : {this.state.account.rsId}</ListItem>
        <ListItem insetChildren={true}>{i18n.show('balance')}    : {this.state.account.balance} (VGO)</ListItem>
        <ListItem insetChildren={true} >{i18n.show('public_key')} : <span>{this.state.account.pk}</span></ListItem>
        <ListItem insetChildren={true} onClick={() => {
          this.copyAccountInfo()
        }}> {i18n.show('copy_account_info')}</ListItem>
      </List>
      <Divider inset={true} />
      {this.state.account.transactions ? this.renderTransactionList() : null}
      <Divider inset={true} />
    </div>)
  }

  renderTransactionList() {
    let transactionsInfo = [];
    this.state.account.transactions.map((transaction) => {
      let item = <ListItem insetChildren={true}> {transaction.unconfirmed ? i18n.show('no') : i18n.show('yes')} | {i18n.show(transaction.type)} | {transaction.from}  -->  {transaction.to} | {transaction.amount} : {transaction.fee} |  height: {transaction.height}</ListItem>
      transactionsInfo.push(item);
    });

    return (<List>
      <ListItem insetChildren={true}>{i18n.show('recent_transactions')} :</ListItem>
      <ListItem insetChildren={true}>{i18n.show('confirmed')} | {i18n.show('tr_type')} |  {i18n.show('from')} --> {i18n.show('to')}  |  {i18n.show('amount')} : {i18n.show('fee')} | {i18n.show('height')}</ListItem>
      {
        transactionsInfo
      }
    </List>);
  }

}
module.exports = AccountPage