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
const {remote} = require('electron')

class ServicePage extends React.Component {
  constructor(props) {
    super(props)
    this.state = this.props.state;
    // this.state.resource = { fee: 1, deadline: 5, resId: this.props.state.resId };
    this.state.service = { deadline: 5, fee: 1, comment: '', price: 1 }
    this.state.message = i18n.show('service_title');
  }

  onPurchaseDone(ok) {
    console.log('on service ok=' + ok);
    if (ok)
      this.state.message = i18n.show('service_ok');
    else
      this.state.message = i18n.show('err');
  }

  setFee(_, fee) {
    this.state.service.fee = fee;
  }
  setDeadline(_, deadline) {
    this.state.service.deadline = deadline;
  }
  setPrice(_, price) {
    this.state.service.price = price;
  }
  setComment(_, comment) {
    this.state.service.comment = comment;
  }

  submit() {
    let userSecHex = remote.getGlobal('vgoAccount').userSecHex;
    gege.publishService(userSecHex,this.state.service, this.onPurchaseDone)
  }

  render() {
    return (<div>
      <List>
        <ListItem insetChildren={true}>{i18n.show('publish_service')}</ListItem>
      </List>
      <Divider inset={true} />
      <List>
        <ListItem insetChildren={true}>
          <label>{i18n.show('year_fee')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('year_fee_hint')}
            rows={1}
            rowsMax={10}
            value={this.state.service.price}
            onChange={this.setPrice.bind(this)} />
        </ListItem>
        <ListItem insetChildren={true}>
          <div key='comment' className='torrent-attribute'>
            <label>{i18n.show('tags')}:</label>
            <TextField
              className='torrent-comment control'
              hintText={i18n.show('tags_hint')}
              multiLine
              rows={1}
              rowsMax={10}
              value={this.state.comment}
              onChange={this.setComment.bind(this)} />
          </div>
        </ListItem>
        <ListItem insetChildren={true}>
          <label>{i18n.show('deadline')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('deadline_hint')}
            rows={1}
            rowsMax={10}
            value={this.state.service.deadline}
            onChange={this.setDeadline.bind(this)} />
        </ListItem>
        <ListItem insetChildren={true} >
          <label>{i18n.show('fee')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('fee_hint')}
            rows={1}
            rowsMax={10}
            value={this.state.service.fee}
            onChange={this.setFee.bind(this)} />
        </ListItem>
      </List>
      <Divider inset={true} />
      <List>
        <ListItem insetChildren={true}> {this.state.message}</ListItem>
        <ListItem insetChildren={true}>
          <FlatButton
            label={i18n.show('publish_service')}
            onClick={() => this.submit()}><ActionPayment /> </FlatButton></ListItem>
      </List>
    </div>)
  }

}
module.exports = ServicePage