const React = require('react')
const prettyBytes = require('prettier-bytes')
const config = require('../../config')
const Checkbox = require('material-ui/Checkbox').default
const BottomNavigation = require('material-ui/BottomNavigation').default
const BottomNavigationItem = require('material-ui/BottomNavigation/BottomNavigationItem').default

const AvRecentActors = require('material-ui/svg-icons/av/recent-actors').default;
const FontIcon = require('material-ui/FontIcon').default
const CommunicationScreenShare = require('material-ui/svg-icons/communication/screen-share').default
const ActionFavorite = require('material-ui/svg-icons/action/favorite').default;
const SocialShare = require('material-ui/svg-icons/social/share').default;
const PlacesRoomService = require('material-ui/svg-icons/places/room-service').default;

const recentsIcon = <AvRecentActors />;
const favoritesIcon = <ActionFavorite />;
const nearbyIcon = <CommunicationScreenShare />;
const shareIcon = <SocialShare />
const serviceIcon = <PlacesRoomService />


const LinearProgress = require('material-ui/LinearProgress').default

const TorrentSummary = require('../lib/torrent-summary')
const TorrentPlayer = require('../lib/torrent-player')
const { dispatcher } = require('../lib/dispatcher')
const ReactPaginate = require('react-paginate')
const GegevController = require('../gege/gegev-controller')

const { Badge, Card, CardBody, CardHeader, Col, ListGroup, ListGroupItem, ListGroupItemHeading,
  ListGroupItemText, Row, TabContent, TabPane } = require('reactstrap')

var i18n = new (require('../../renderer/i18n'))


module.exports = class TorrentList extends React.Component {

  constructor(props) {
    super(props)
    this.state = this.props.state
    this.state.selectedIdx = 0;
    this.state.page = 1;
    this.gg = new GegevController(this.state);
    /*
    do not auto refresh.this will remove the new added res from the list
    setTimeout(() => {
      this.selectTab(0)
    }, 3000);
    */
  }

  render() {
    const contents = []
    if (state.downloadPathStatus === 'missing') {
      contents.push(
        <div key='torrent-missing-path'>
          <p>Download path missing: {state.saved.prefs.downloadPath}</p>
          <p>Check that all drives are connected?</p>
          <p>Alternatively, choose a new download path
            in <a href='#' onClick={dispatcher('preferences')}>Preferences</a>
          </p>
        </div>
      )
    }
    if (state.resources && state.resources.length > 0) {
      const torrentElems = state.resources.map(
        (torrentSummary) => this.renderTorrent(torrentSummary)
      )
      contents.push(...torrentElems)
    }

    /*
    contents.push(
      <div key='torrent-placeholder' className='torrent-placeholder'>
        <span className='ellipsis'>Drop a torrent file here or paste a magnet link</span>
      </div>
    )
    */
    return (
      <div>
        {this.navigationUI()}
        <Card>
          <CardBody>
            {contents}
          </CardBody>
        </Card>
        <div>
          <ReactPaginate previousLabel={"<<"}
            nextLabel={">>"}
            breakLabel={<a href="">...</a>}
            breakClassName={"break-me"}
            pageCount={100}
            marginPagesDisplayed={2}
            pageRangeDisplayed={5}
            onPageChange={this.handlePageClick.bind(this)}
            pageClassName={"pageli"}
            previousClassName={"pageli"}
            nextClassName={"pageli"}
            breakClassName={"pageli"}
            activeClassName={"active"} />
        </div>
      </div>
    )
  }

  selectTab(index) {
    this.state.selectedIdx = index;
    this.gg.loadResources(this.state.page, this.state.query, index);
  }

  navigationUI() {
    return (<BottomNavigation selectedIndex={this.state.selectedIndex}>
      <BottomNavigationItem
        label={i18n.show('recent')}
        icon={recentsIcon}
        onClick={() => this.selectTab(0)}
      />
      <BottomNavigationItem
        label={i18n.show('earn_vgo')}
        icon={shareIcon}
        onClick={dispatcher('openFiles')}
      />
    </BottomNavigation>)
  }

  showResourceInfo(hash) {
    console.log("showResourceInfo " + hash);
  }

  buyRes(tor) {
    dispatch('buyResource', tor.infoHash)
  }

  handlePageClick(data) {
    var page = data.selected;
    this.state.page = page + 1;
    this.gg.loadResources(this.state.page, this.state.query, this.state.selectedIdx);
  }

  renderTorrent(torrentSummary) {
    const state = this.props.state
    const infoHash = torrentSummary.infoHash
    const isSelected = infoHash && state.selectedInfoHash === infoHash

    // Background image: show some nice visuals, like a frame from the movie, if possible
    const style = {}
    if (torrentSummary.posterFileName) {
      const gradient = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.4) 100%)'
      const posterPath = TorrentSummary.getPosterPath(torrentSummary)
      //style.backgroundImage = `${gradient}, url('${posterPath}')`
    }

    // Foreground: name of the torrent, basic info like size, play button,
    // cast buttons if available, and delete
    const classes = ['torrent']
    if (isSelected) classes.push('selected')
    if (!infoHash) classes.push('disabled')
    if (!torrentSummary.torrentKey) throw new Error('Missing torrentKey')
    return (
      <div
        id={torrentSummary.testID && ('torrent-' + torrentSummary.testID)}
        key={torrentSummary.torrentKey}
        style={style}
        className={classes.join(' ')}
        onContextMenu={infoHash && dispatcher('openTorrentContextMenu', infoHash)}
        onClick={infoHash && dispatcher('toggleSelectTorrent', infoHash)}>
        {this.renderTorrentMetadata(torrentSummary)}
        {infoHash ? this.renderTorrentButtons(torrentSummary) : null}
        {isSelected ? this.renderTorrentDetails(torrentSummary) : null}
        <hr />
      </div>
    )
  }

  // Show name, download status, % complete
  renderTorrentMetadata(torrentSummary) {
    const name = torrentSummary.name || torrentSummary.torrentKey || 'Loading torrent...'
    const price = torrentSummary.price;
    const owner = torrentSummary.owner;

    let elements = [(
      <div key='name' className='name ellipsis'>{name} | {owner}  | <span onClick={() => this.buyRes(torrentSummary)} >{i18n.show('price')} :  {price} VGO</span></div>
    )]
    if(price > 0){
      elements = [(
        <div key='name' className='name ellipsis'>{name} | {owner}  | <span onClick={() => this.buyRes(torrentSummary)} >Click here to pay {price} VGO coins.</span></div>
      )]
    }
    // If it's downloading/seeding then show progress info
    const prog = torrentSummary.progress
    let progElems
    if (torrentSummary.error) {
      progElems = [getErrorMessage(torrentSummary)]
    } else if (torrentSummary.status !== 'paused' && prog) {
      progElems = [
        renderDownloadCheckbox(),
        renderTorrentStatus(),
        renderProgressBar(torrentSummary),
        renderPercentProgress(),
        renderTotalProgress(),
        renderPeers(),
        renderSpeeds(),
        renderEta()
      ]
    } else {
      progElems = [
        renderDownloadCheckbox(),
        renderTorrentStatus()
      ]
    }
    elements.push(
      <div key='progress-info' className='ellipsis'>
        {progElems}
      </div>
    )

    return (<div key='metadata' className='metadata'>{elements}</div>)

    function renderDownloadCheckbox() {
      const infoHash = torrentSummary.infoHash
      const isActive = ['downloading', 'seeding', 'new'].includes(torrentSummary.status)
      return (
        <Checkbox
          key='download-button'
          className={'control download ' + torrentSummary.status}
          style={{
            display: 'inline-block',
            width: 32
          }}
          iconStyle={{
            width: 20,
            height: 20
          }}
          checked={isActive}
          onClick={stopPropagation}
          onCheck={dispatcher('toggleTorrent', infoHash)} />
      )
    }

    function renderProgressBar(tor) {
      const progress = Math.floor(100 * prog.progress)
      const styles = {
        wrapper: {
          display: 'inline-block',
          marginRight: 8
        },
        progress: {
          height: 8,
          width: 30
        }
      }
      if(tor.price > 0){
        return (
          <div style={styles.wrapper}>
            <LinearProgress style={styles.progress} mode='determinate' value={progress} />
          </div>
        )
      }else{
        return (
          <div style={styles.wrapper}>
            <LinearProgress style={styles.progress} mode='determinate' value={progress} />
          </div>
        )
      }
      
    }

    function renderPercentProgress() {
      const progress = Math.floor(100 * prog.progress)
      return (<span key='percent-progress'>{progress}%</span>)
    }

    function renderTotalProgress() {
      const downloaded = prettyBytes(prog.downloaded)
      const total = prettyBytes(prog.length || 0)
      if (downloaded === total) {
        return (<span key='total-progress'>{downloaded}</span>)
      } else {
        return (<span key='total-progress'>{downloaded} / {total}</span>)
      }
    }

    function renderPeers() {
      if (prog.numPeers === 0) return
      const count = prog.numPeers === 1 ? 'peer' : 'peers'
      return (<span key='peers'>{prog.numPeers} {count}</span>)
    }

    function renderSpeeds() {
      let str = ''
      if (prog.downloadSpeed > 0) str += ' ↓ ' + prettyBytes(prog.downloadSpeed) + '/s'
      if (prog.uploadSpeed > 0) str += ' ↑ ' + prettyBytes(prog.uploadSpeed) + '/s'
      if (str === '') return
      return (<span key='download'>{str}</span>)
    }

    function renderEta() {
      const downloaded = prog.downloaded
      const total = prog.length || 0
      const missing = total - downloaded
      const downloadSpeed = prog.downloadSpeed
      if (downloadSpeed === 0 || missing === 0) return

      const rawEta = missing / downloadSpeed
      const hours = Math.floor(rawEta / 3600) % 24
      const minutes = Math.floor(rawEta / 60) % 60
      const seconds = Math.floor(rawEta % 60)

      // Only display hours and minutes if they are greater than 0 but always
      // display minutes if hours is being displayed
      const hoursStr = hours ? hours + 'h' : ''
      const minutesStr = (hours || minutes) ? minutes + 'm' : ''
      const secondsStr = seconds + 's'

      return (<span>{hoursStr} {minutesStr} {secondsStr} remaining</span>)
    }

    function renderTorrentStatus() {
      let status
      if (torrentSummary.status === 'paused') {
        if (!torrentSummary.progress)
          status = ''
        else if (torrentSummary.progress.progress === 1)
          status = i18n.show('not_seeding')
        else
          status = i18n.show('paused')
      } else if (torrentSummary.status === 'downloading') {
        status = i18n.show('downloading')
      } else if (torrentSummary.status === 'seeding') {
        status = i18n.show('seeding')
      } else { // torrentSummary.status is 'new' or something unexpected
        status = ''
      }
      return (<span>{status}</span>)
    }
  }

  // Download button toggles between torrenting (DL/seed) and paused
  // Play button starts streaming the torrent immediately, unpausing if needed
  renderTorrentButtons(torrentSummary) {
    const infoHash = torrentSummary.infoHash

    // Only show the play/dowload buttons for torrents that contain playable media
    let playButton

    if (!torrentSummary.error && TorrentPlayer.isPlayableTorrentSummary(torrentSummary)) {


      playButton = (
        <i
          key='play-button'
          title='Start streaming'
          className={'icon play'}
          onClick={dispatcher('playFile', infoHash)}>
          play_circle_outline
          </i>)
    } else {

      if (torrentSummary.isService) {
        playButton = (
          <i
            key='play-button'
            title={i18n.show('click_service')}
            className={'icon play'}
            onClick={dispatcher('buyResource', infoHash)}>
            play_circle_outline
          </i>)
      } else {
        //download if not playable
        playButton = (
          <i
            key='play-button'
            title={i18n.show('download_play')}
            className={'icon play'}
            onClick={dispatcher('toggleTorrent', infoHash)}>
            play_circle_outline
        </i>
        )
      }
    }

    let urlButton = (
      <i
        key='info-button'
        title={i18n.show('show_url')}
        className={'icon info'}
        onClick={dispatcher('showResourceInfo', infoHash)}>
        info
    </i>
    )

    return (
      <div className='torrent-controls'>
        {playButton}
        <i
          key='delete-button'
          className='icon delete'
          title='Hide resource'
          onClick={dispatcher('confirmDeleteTorrent', infoHash, false)}>
          close
        </i>
        {urlButton}
      </div>
    )
  }

  // Show files, per-file download status and play buttons, and so on
  renderTorrentDetails(torrentSummary) {
    let filesElement
    if (torrentSummary.error || !torrentSummary.files) {
      let message = ''
      if (torrentSummary.error === 'path-missing') {
        // Special case error: this torrent's download dir or file is missing
        message = 'Missing path: ' + TorrentSummary.getFileOrFolder(torrentSummary)
      } else if (torrentSummary.error) {
        // General error for this torrent: just show the message
        message = torrentSummary.error.message || torrentSummary.error
      } else if (torrentSummary.status === 'paused') {
        // No file info, no infohash, and we're not trying to download from the DHT
        message = 'Failed to load torrent info. Click the download button to try again...'
      } else {
        // No file info, no infohash, trying to load from the DHT
        message = 'Downloading torrent info...'
      }
      filesElement = (
        <div key='files' className='files warning'>
          {message}
        </div>
      )
    } else {
      // We do know the files. List them and show download stats for each one
      const fileRows = torrentSummary.files
        .filter((file) => !file.path.includes('/.____padding_file/'))
        .map((file, index) => ({ file, index }))
        .map((object) => this.renderFileRow(torrentSummary, object.file, object.index))

      filesElement = (
        <div key='files' className='files'>
          <table>
            <tbody>
              {fileRows}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div key='details' className='torrent-details'>
        {filesElement}
      </div>
    )
  }

  // Show a single torrentSummary file in the details view for a single torrent
  renderFileRow(torrentSummary, file, index) {
    // First, find out how much of the file we've downloaded
    // Are we even torrenting it?
    const isSelected = torrentSummary.selections && torrentSummary.selections[index]
    let isDone = false // Are we finished torrenting it?
    let progress = ''
    if (torrentSummary.progress && torrentSummary.progress.files &&
      torrentSummary.progress.files[index]) {
      const fileProg = torrentSummary.progress.files[index]
      isDone = fileProg.numPiecesPresent === fileProg.numPieces
      progress = Math.round(100 * fileProg.numPiecesPresent / fileProg.numPieces) + '%'
    }

    // Second, for media files where we saved our position, show how far we got
    let positionElem
    if (file.currentTime) {
      // Radial progress bar. 0% = start from 0:00, 270% = 3/4 of the way thru
      positionElem = this.renderRadialProgressBar(file.currentTime / file.duration)
    }

    // Finally, render the file as a table row
    const isPlayable = TorrentPlayer.isPlayable(file)
    const infoHash = torrentSummary.infoHash
    let icon
    let handleClick
    if (isPlayable) {
      icon = 'play_arrow' /* playable? add option to play */
      handleClick = dispatcher('playFile', infoHash, index)
    } else {
      icon = 'description' /* file icon, opens in OS default app */
      handleClick = isDone
        ? dispatcher('openItem', infoHash, index)
        : (e) => e.stopPropagation() // noop if file is not ready
    }
    // TODO: add a css 'disabled' class to indicate that a file cannot be opened/streamed
    let rowClass = ''
    if (!isSelected) rowClass = 'disabled' // File deselected, not being torrented
    if (!isDone && !isPlayable) rowClass = 'disabled' // Can't open yet, can't stream
    return (
      <tr key={index} onClick={handleClick}>
        <td className={'col-icon ' + rowClass}>
          {positionElem}
          <i className='icon'>{icon}</i>
        </td>
        <td className={'col-name ' + rowClass}>
          {file.name}
        </td>
        <td className={'col-progress ' + rowClass}>
          {isSelected ? progress : ''}
        </td>
        <td className={'col-size ' + rowClass}>
          {prettyBytes(file.length)}
        </td>
        <td className='col-select'
          onClick={dispatcher('toggleTorrentFile', infoHash, index)}>
          <i className='icon deselect-file'>{isSelected ? 'close' : 'add'}</i>
        </td>
      </tr>
    )
  }

  renderRadialProgressBar(fraction, cssClass) {
    const rotation = 360 * fraction
    const transformFill = { transform: 'rotate(' + (rotation / 2) + 'deg)' }
    const transformFix = { transform: 'rotate(' + rotation + 'deg)' }

    return (
      <div key='radial-progress' className={'radial-progress ' + cssClass}>
        <div key='circle' className='circle'>
          <div key='mask-full' className='mask full' style={transformFill}>
            <div key='fill' className='fill' style={transformFill} />
          </div>
          <div key='mask-half' className='mask half'>
            <div key='fill' className='fill' style={transformFill} />
            <div key='fill-fix' className='fill fix' style={transformFix} />
          </div>
        </div>
        <div key='inset' className='inset' />
      </div>
    )
  }
}

function stopPropagation(e) {
  e.stopPropagation()
}

function getErrorMessage(torrentSummary) {
  const err = torrentSummary.error
  if (err === 'path-missing') {
    return (
      <span>
        Path missing.<br />
        Fix and restart the app, or delete the torrent.
      </span>
    )
  }
  return 'Error'
}
