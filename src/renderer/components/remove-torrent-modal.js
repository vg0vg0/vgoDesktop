const React = require('react')
const TextField = require('material-ui/TextField').default
const ModalOKCancel = require('./modal-ok-cancel')
const {dispatch, dispatcher} = require('../lib/dispatcher')
const {deleteResource} = require('../vgo/manager')
const {remote} = require('electron')

var i18n = new(require('../../renderer/i18n'))
const RaisedButton = require('material-ui/RaisedButton').default
module.exports = class RemoveTorrentModal extends React.Component {
  render () {
    const state = this.props.state
    const message = state.modal.deleteData
      ? 'Are you sure you want to remove this torrent from the list and delete the data file?'
      : 'Are you sure you want to remove this torrent from the list?'
    const deleteTitle = i18n.show('del_res_title')  
    const deleteMessage = i18n.show('del_pay_title');
    const buttonText = state.modal.deleteData ? 'REMOVE DATA' : i18n.show('delete')
    return (
      <div>
        <p><strong>{deleteTitle}</strong></p>
        <p><strong>{deleteMessage}</strong></p>
        <p><strong>{i18n.show('illegal_report')}</strong></p>
        <RaisedButton
          className='control ok'
          primary
          label={i18n.show('local_delete')}
          onClick={localDelete}
          autoFocus />
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
          okText={buttonText}
          onOK={handleRemove} />
      </div>
    )

    function localDelete(){
      dispatch('deleteTorrent', state.modal.infoHash, true);
      dispatch('exitModal')
    }

    function handleRemove () {
      let userSecHex = remote.getGlobal('vgoAccount').userSecHex;
      deleteResource(userSecHex,state.modal.infoHash,(del) =>{
          console.log("delete res=" + del)
          if(del){
            dispatch('deleteTorrent', state.modal.infoHash, state.modal.deleteData)
          }else{
            const notif = new window.Notification(i18n.show('err'), {
              body: i18n.show('delete_failed'),
              silent: true
            })
          }
          dispatch('exitModal')
      })

    }
  }
}

function handleKeyDown (e) {
  //if (e.which === 13) handleOK.call(this) /* hit Enter to submit */
}