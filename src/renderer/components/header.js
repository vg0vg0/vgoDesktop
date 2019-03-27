const React = require('react')
const TextField = require('material-ui/TextField').default
const { dispatcher, dispatch } = require('../lib/dispatcher')
const Badge = require('material-ui/Badge').default
const IconButton = require('material-ui/IconButton').default
const NotificationsIcon = require('material-ui/svg-icons/social/notifications').default
const { remote } = require('electron')
const { getAccountInfo } = require('../vgo/manager')
var i18n = new (require('../../renderer/i18n'))

class Header extends React.Component {

  constructor(props) {
    super(props)
    this.state = this.props.state;
    //console.log(this.state)
    this.state.query = ''
    this.setQuery = (_, query) => this.setState({ query })
  }

  componentDidMount() {
    var intervalId = setInterval(this.updateStatus, 10 * 1000);
    this.state.intervalId = intervalId
  }

  componentWillUnmount() {
    // use intervalId from the state to clear the interval
    clearInterval(this.state.intervalId);
  }


  updateStatus() {
    let vv = Date.now() % (1000 * 60 * 60);
    if (vv < 60 * 1000) {
      let userSecHex = remote.getGlobal('vgoAccount').userSecHex;
      dispatch('reboot', userSecHex)
    } else {
      dispatch('updateStatus')
      getAccountInfo(this.state.account.rsId, (act) => {
        if (act)
          this.state.account = act;
      });
    }
  }

  render() {
    const loc = this.props.state.location

    if (state.location.url() == 'login')
      return null;
    return (
      <div className='header'
        onMouseMove={dispatcher('mediaMouseMoved')}
        onMouseEnter={dispatcher('mediaControlsMouseEnter')}
        onMouseLeave={dispatcher('mediaControlsMouseLeave')}>
        {this.getTitle()}
        <div className='nav left float-left'>
          <i
            className={'icon home ' + (loc.hasBack() ? '' : 'disabled')}
            title={i18n.show('home')}
            onClick={dispatcher('home')}>
            home
          </i>
          <i
            className={'icon back ' + (loc.hasBack() ? '' : 'disabled')}
            title={i18n.show('back')}
            onClick={dispatcher('back')}>
            chevron_left
          </i>
          <i
            className={'icon forward ' + (loc.hasForward() ? '' : 'disabled')}
            title={i18n.show('forward')}
            onClick={dispatcher('forward')}>
            chevron_right
          </i>
          <i onClick={dispatcher('account', this.state.account.rsId)}
            title={i18n.show('click_account')}
          >
            {i18n.show('account_id')} : <span>{this.state.account.rsId}</span>   |  {i18n.show('balance')} :  {this.state.account.balance} (VGo)
          </i>
          <i title={i18n.show('click_blocklist')} onClick={dispatcher('blockList', 1)}>  |  {i18n.show('block_height')}: {this.state.status.height} [{this.state.status.timeStamp}]
          </i>
          <i title={i18n.show('click_unconfirmed')} onClick={dispatcher('unconfirmedList', 1)}>  |  {i18n.show('unconfirmed')}: {this.state.status.unconfirmed}
          </i>
          <i> | {i18n.show('peers')} : {this.state.status.peers}</i>
        </div>
        <div className='nav right float-right'>
          {this.getAddButton()}
        </div>
      </div>
    )
  }

  getTitle() {
    if (process.platform !== 'darwin') return null
    const state = this.props.state
    return (<div className='title ellipsis'>{state.window.title}</div>)
  }

  getAddButton() {
    const state = this.props.state
    if (state.location.url() !== 'home') return null
    return (
      <div>
        <TextField
          value={this.state.query}
          onChange={this.setQuery}
          className='torrent-comment control'
          hintText={i18n.show('search_hint')} />
        <i
          className='icon search'
          title='search'
          onClick={dispatcher('searchFiles', this.state.query)}>
          search
      </i>
      </div>
    )
  }
}

module.exports = Header
