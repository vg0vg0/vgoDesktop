const React = require('react')
const { remote } = require('electron')
const TextField = require('material-ui/TextField').default
var i18n = new (require('../../renderer/i18n'))
const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')
const { Card, CardBody, Input, InputGroupAddon, InputGroupText, InputGroup, CardHeader, Button,
  FormGroup,Label } = require('reactstrap')
const { getResourceInfo, purchaseGGResource } = require('../vgo/manager')
let userSecHex = remote.getGlobal('vgoAccount').userSecHex;

module.exports = class VGoDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = this.props.state;
  }

  componentDidMount() {
    let resId = this.state.modal.infoHash
    getResourceInfo(resId, (resource) => {
      this.setState({ resId, resource })
    })
  }

  updateDeadline(e) {
    if (e && e.target) {
      this.deadline = e.target.value;
      if (this.deadline.length == 0) {
        this.deadline = 5;
      }
    }
  }

  updateFee(e) {
    if (e && e.target) {
      this.fee = e.target.value;
      if (this.fee.length == 0) {
        this.fee = 1;
      }
    }
  }

  renderdialogMsg() {
    if (this.state.renderDesposit) {
      return (<div>
        <Label>{this.state.dialogMsg}</Label>
        <DepositDialog />
      </div>)
    } else
      if (this.state.dialogMsg) {
        return (<Label>{this.state.dialogMsg}</Label>)
      }
    return null;
  }

  doPayVgo() {
    let sec = userSecHex;
    let res = this.state.resource;
    res.fee = this.fee ? this.fee : 1;
    res.deadline = this.deadline ? this.deadline : 5;
    purchaseGGResource(userSecHex, res, (ok) => {
      if (ok) {
        this.setState({ dialogMsg: 'success' })
      } else {
        this.setState({ dialogMsg: 'failed.' })
      }
    })
  }

  render() {
    if (!this.state.resource)
      return null;
    return (
      <div className='open-torrent-address-modal'>
        <div>
          <Card>
            <CardHeader style={{ backgroundColor: 'white' }}>
              <i className="fa fa-align-justify"></i> {this.state.resource.tags}
            </CardHeader>
            <CardBody>
              <FormGroup>
                <div className="controls">
                  <InputGroup className="input-prepend">
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>Price:</InputGroupText>
                    </InputGroupAddon>
                    <Input id="appendedPrependedInput" size="16" type="text" placeholder={this.state.resource.price} />
                    <InputGroupAddon addonType="append">
                      <InputGroupText>VGo coin</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </FormGroup>
              <FormGroup>
                <div className="controls">
                  <InputGroup className="input-prepend">
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>miner Fee:</InputGroupText>
                    </InputGroupAddon>
                    <Input id="appendedPrependedInput" size="16" type="text" onChange={this.updateFee.bind(this)} placeholder='miner Fee' />
                    <InputGroupAddon addonType="append">
                      <InputGroupText>VGo coin</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </FormGroup>
              <FormGroup>
                <div className="controls">
                  <InputGroup className="input-prepend">
                    <InputGroupAddon addonType="prepend">
                      <InputGroupText>Deadline:</InputGroupText>
                    </InputGroupAddon>
                    <Input id="appendedPrependedInput" size="16" onChange={this.updateDeadline.bind(this)} type="text" placeholder='5' />
                    <InputGroupAddon addonType="append">
                      <InputGroupText>minutes</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </FormGroup>
              <FormGroup>
                {this.renderdialogMsg()}
              </FormGroup>
              <Button color="danger" onClick={this.doPayVgo.bind(this)}>Pay</Button>
            </CardBody>
          </Card>
        </div>
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
        />
      </div>
    )
  }

}

function handleKeyDown(e) {
  if (e.which === 13) handleOK.call(this) /* hit Enter to submit */
}

function handleOK() {
  dispatch('exitModal')
  dispatch('addTorrent', this.torrentURL.input.value)
}
