const React = require('react')
const TextField = require('material-ui/TextField').default
const config = require('../../config')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')

const {parameters} = require('../vgo/parameters') 

var i18n = new (require('../../renderer/i18n'))

module.exports = class ShowResourceInfoModal extends React.Component {
  render() {
    const state = this.props.state

    return (
      <div className='open-torrent-address-modal'>
        <p><label>{i18n.show('resource_info')}</label></p>
        <div>
          <i>{i18n.show('resource_url')}:</i>
          <TextField
            id='resource-url-field'
            className='control'
            value={parameters.getVGoConfigs('online_server', '') + "/#/vgo#" + state.modal.infoHash}
            fullWidth />
        </div>
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
          okText='OK'
          onOK={handleOK.bind(this)} />
      </div>
    )
  }
  componentDidMount() {
  }
}

function handleOK() {
  dispatch('exitModal')
}
