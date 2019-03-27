const createTorrent = require('create-torrent')
const path = require('path')
const prettyBytes = require('prettier-bytes')
const React = require('react')

const { dispatch, dispatcher } = require('../lib/dispatcher')

const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const TextField = require('material-ui/TextField').default
const Checkbox = require('material-ui/Checkbox').default

const CreateTorrentErrorPage = require('../components/create-torrent-error-page')
const Heading = require('../components/heading')
const ShowMore = require('../components/show-more')
const { preShareResource } = require('../vgo/manager')
const config = require('../../config')
const appConfig = require('application-config')('VGO')
appConfig.filePath = path.join(config.CONFIG_PATH, 'vgo-config.json')
const { List, ListItem } = require('material-ui/List')

var i18n = new (require('../../renderer/i18n'))

// Shows a basic UI to create a torrent, from an already-selected file or folder.
// Includes a "Show Advanced..." button and more advanced UI.
class CreateTorrentPage extends React.Component {
  constructor(props) {
    super(props)

    const state = this.props.state
    const info = state.location.current()
    this.account = state.account;
    // First, extract the base folder that the files are all in
    let pathPrefix = info.folderPath
    if (!pathPrefix) {
      pathPrefix = info.files.map((x) => x.path).reduce(findCommonPrefix)
      if (!pathPrefix.endsWith('/') && !pathPrefix.endsWith('\\')) {
        pathPrefix = path.dirname(pathPrefix)
      }
    }
    this.msg = ''
    // Then, exclude .DS_Store and other dotfiles
    const files = info.files
      .filter((f) => !containsDots(f.path, pathPrefix))
      .map((f) => ({ name: f.name, path: f.path, size: f.size }))
    if (files.length === 0) return (<CreateTorrentErrorPage state={state} />)

    // Then, use the name of the base folder (or sole file, for a single file torrent)
    // as the default name. Show all files relative to the base folder.
    let defaultName, basePath
    if (files.length === 1) {
      // Single file torrent: /a/b/foo.jpg -> torrent name 'foo.jpg', path '/a/b'
      defaultName = files[0].name
      basePath = pathPrefix
    } else {
      // Multi file torrent: /a/b/{foo, bar}.jpg -> torrent name 'b', path '/a'
      defaultName = path.basename(pathPrefix)
      basePath = path.dirname(pathPrefix)
    }

    // Default trackers
    const trackers = createTorrent.announceList.join('\n')

    let fee = '0';
    if (this.account && parseInt(this.account.balance >= 0)){
      fee = '1'
    }

    this.state = {
      comment: defaultName,
      price: '1',
      fee: fee,
      pathPrefix,
      basePath,
      defaultName,
      files,
      trackers,
      secret: '',
      deadline: 5,
      showFreevgo: false
    }

    // Create React event handlers only once
    this.setIsPrivate = (_, isPrivate) => this.setState({ isPrivate })
    this.setComment = (_, comment) => this.setState({ comment })
    this.setDeadline = (_, deadline) => this.setState({ deadline })
    this.setPrice = (_, price) => this.setState({ price })
    this.setSecret = (_, secret) => this.setState({ secret })
    this.setFee = (_, fee) => this.setState({ fee })
    this.setTrackers = (_, trackers) => this.setState({ trackers })
    this.handleSubmit = handleSubmit.bind(this)
  }

  render() {
    const files = this.state.files

    // Sanity check: show the number of files and total size
    const numFiles = files.length
    const totalBytes = files
      .map((f) => f.size)
      .reduce((a, b) => a + b, 0)
    const torrentInfo = `${numFiles} files, ${prettyBytes(totalBytes)}`

    return (
      <div className='create-torrent'>
        <Heading level={1}>{i18n.show('share_res')} [ {this.state.defaultName} ] {i18n.show('earn_vgo')}</Heading>
        <div className='torrent-info'>{i18n.show('no_illegal')}</div>
        <div className='torrent-info'>{torrentInfo}</div>
        <div className='torrent-attribute'>
          <label>Path:</label>
          <div>{this.state.pathPrefix}</div>
        </div>
        <div key='price' className='torrent-attribute'>
          <label>{i18n.show('price')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('price')}
            rows={1}
            rowsMax={10}
            value={this.state.price}
            onChange={this.setPrice} />
          <FlatButton
            className='control cancel'
            label={i18n.show('free-res')}
            onClick={e => this.setState({ price: 0, fee: 10 })} />
        </div>
        <div key='comment' className='torrent-attribute'>
          <label>{i18n.show('tags')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('tags_hint')}
            multiLine
            rows={1}
            rowsMax={10}
            value={this.state.comment}
            onChange={this.setComment} />
        </div>
        <div key='deadline' className='torrent-attribute'>
          <label>{i18n.show('deadline')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('deadline_hint')}
            rows={1}
            rowsMax={30}
            value={this.state.deadline}
            onChange={this.setDeadline} />
        </div>
        <div key='fee' className='torrent-attribute'>
          <label>{i18n.show('fee')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('fee_hint')}
            rows={1}
            rowsMax={30}
            value={this.state.fee}
            onChange={this.setFee} />
        </div>
        <ShowMore
          style={{
            marginBottom: 10
          }}
          hideLabel='Hide advanced settings...'
          showLabel='Show advanced settings...'>
          {this.renderAdvanced()}
        </ShowMore>
        <div>
          <label>{this.msg}</label>
        </div>
        <div className='float-right'>
          <FlatButton
            className='control cancel'
            label='Cancel'
            style={{
              marginRight: 10
            }}
            onClick={dispatcher('cancel')} />
          <RaisedButton
            className='control create-torrent-button'
            label={i18n.show('share_res')}
            primary
            onClick={this.handleSubmit} />
        </div>
      </div>
    )
  }

  // Renders everything after clicking Show Advanced...:
  // * Is Private? (private torrents, not announced to DHT)
  // * Announce list (trackers)
  // * Comment
  renderAdvanced() {
    // Create file list
    const maxFileElems = 100
    const files = this.state.files
    const fileElems = files.slice(0, maxFileElems).map((file, i) => {
      const relativePath = path.relative(this.state.pathPrefix, file.path)
      return (<div key={i}>{relativePath}</div>)
    })
    if (files.length > maxFileElems) {
      fileElems.push(<div key='more'>+ {files.length - maxFileElems} more</div>)
    }

    // Align the text fields
    const textFieldStyle = { width: '' }
    const textareaStyle = { margin: 0 }

    return (
      <div key='advanced' className='create-torrent-advanced'>
        <div key='trackers' className='torrent-attribute'>
          <label>Trackers:</label>
          <TextField
            className='torrent-trackers control'
            style={textFieldStyle}
            textareaStyle={textareaStyle}
            multiLine
            rows={2}
            rowsMax={10}
            value={this.state.trackers}
            onChange={this.setTrackers} />
        </div>

        <div key='files' className='torrent-attribute'>
          <label>{i18n.show('files')}:</label>
          <div>{fileElems}</div>
        </div>
      </div>
    )
  }
}

function handleSubmit() {
  if (parseInt(this.account.balance == 0)){
    this.state.fee = 0;
  }

  const announceList = this.state.trackers
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  const options = {
    // We can't let the user choose their own name if we want WebTorrent
    // to use the files in place rather than creating a new folder.
    name: this.state.defaultName,
    path: this.state.basePath,
    files: this.state.files,
    announce: announceList,
    private: this.state.isPrivate,
    //secret : this.state.secret,
    fee: this.state.fee,
    price: this.state.price,
    comment: this.state.comment.trim(),
    deadline: this.state.deadline
  }

  let config = { 'resource': this.state }
  /*
  if (!this.state.price) {
    console.log('invalid price')
    this.msg = i18n.show('invalid_price');
    return;
  }
  */
  let feeint = parseFloat(this.state.fee)
  let priceint = parseInt(this.state.price);

  if (feeint < 0) {
    this.msg = i18n.show('fee err')
    return;
  }
  const notif = new window.Notification(i18n.show('working'), {
    body: i18n.show('wait'),
    silent: true
  })

  appConfig.write(config, (err) => {
    if (err) console.error(err)
    preShareResource(this.state, (ok, err) => {
      if (ok) {
        dispatch('createTorrent', options)
      } else {
        // console.log('share resource transaction err.' + err);
        // dispatch('deleteTorrent', state.modal.infoHash, true);
        const notif = new window.Notification(i18n.show('err'), {
          body: i18n.show('share_failed'),
          silent: true
        })
      }
    })
  })

}

// Finds the longest common prefix
function findCommonPrefix(a, b) {
  let i
  for (i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) break
  }
  if (i === a.length) return a
  if (i === b.length) return b
  return a.substring(0, i)
}

function containsDots(path, pathPrefix) {
  const suffix = path.substring(pathPrefix.length).replace(/\\/g, '/')
  return ('/' + suffix).includes('/.')
}

module.exports = CreateTorrentPage
