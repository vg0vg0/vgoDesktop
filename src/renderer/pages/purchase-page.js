const React = require('react')
const { dispatcher } = require('../lib/dispatcher')
const TextField = require('material-ui/TextField').default
const FlatButton = require('material-ui/FlatButton').default

const ActionPayment = require('material-ui/svg-icons/action/payment').default
const ContentSend = require('material-ui/svg-icons/content/send').default
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
const i18n = new (require('../../renderer/i18n'))
const gg = new (require('../gege/gegev-controller'))
const ReactPaginate = require('react-paginate')

class BuyPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = this.props.state;
    // this.state.resource = { fee: 1, deadline: 5, resId: this.props.state.resId };
    this.state.resource.deadline = 5;
    this.state.resource.fee = 1;
    this.state.message = ''
    this.serviceResources = null
  }

  componentDidMount() {
    if (this.state.resource.isService)
      gg.loadServieResources(1, this.state.resource.owner, (resources) => {
        this.serviceResources = resources;
      })
  }

  handlePageClick(data) {
    var page = data.selected;
    gg.loadServieResources(page, this.state.resource.owner, (resources) => {
      this.serviceResources = resources;
    })
  }

  onPurchaseDone(ok) {
    console.log('onPurchaseDone ok=' + ok);
    if (ok) {
      this.state.message = i18n.show('transaction_ok');
      dispatcher('updateStatus')
    } else {
      this.state.message = i18n.show('err');
    }
  }

  setFee(_, fee) {
    this.state.resource.fee = fee;
  }
  setDeadline(_, deadline) {
    this.state.resource.deadline = deadline;
  }

  renderResource(res) {
    return (<ListItem insetChildren={true}>{res.tags} | {i18n.show('price')} : {res.price} | {res.id}</ListItem>);
  }

  renderResourceList() {
    if (this.serviceResources) {
      let contents = [];
      let reses = this.serviceResources.map((res) => this.renderResource(res));
      contents.push(...reses);
      return (<List>
        <ListItem insetChildren={true}>{i18n.show('resource_list')}</ListItem>
        {contents}
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
      </List>)
    } else
      return null;
  }



  render() {
    //show res list only if aleayd payed
    /*
    if (this.state.resource.isService && this.state.resource.purchased) {
      return (<div>
        <List>
          {this.renderResourceList()}
        </List>
      </div>)
    } else {
      */
    return (<div>
      <List>
        <ListItem insetChildren={true}>{i18n.show('need_pay')}</ListItem>
        <ListItem insetChildren={true}>{i18n.show('res_id')} : {this.state.resource.id} {this.state.resource.isService ? i18n.show('res_service') : ""}</ListItem>
        <ListItem insetChildren={true} >{i18n.show('price')} : {this.state.resource.price} (VGO)</ListItem>
        <ListItem insetChildren={true} >{i18n.show('tags')}: {this.state.resource.tags}</ListItem>
        <ListItem insetChildren={true} >{i18n.show('owner')} : {this.state.resource.owner}</ListItem>
        <ListItem insetChildren={true} >{i18n.show('purchase_records')} :  {this.state.resource.purchased}</ListItem>
      </List>
      <Divider inset={true} />
      <List>
        <ListItem insetChildren={true}>
          <label>{i18n.show('deadline')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('deadline_hint')}
            rows={1}
            rowsMax={10}
            value={this.state.resource.deadline}
            onChange={this.setDeadline.bind(this)} />
        </ListItem>
        <ListItem insetChildren={true} >
          <label>{i18n.show('fee')}:</label>
          <TextField
            className='torrent-comment control'
            hintText={i18n.show('fee_hint')}
            rows={1}
            rowsMax={10}
            value={this.state.resource.fee}
            onChange={this.setFee.bind(this)} />
        </ListItem>
      </List>
      <Divider inset={true} />
      <List>
        <ListItem insetChildren={true}> {this.state.message}</ListItem>
        <ListItem insetChildren={true}>
          <FlatButton
            label={this.state.resource.isService ? i18n.show('buy_service') : i18n.show('buy_res')}
            onClick={dispatcher('purchaseResource', this.state.resource, this.onPurchaseDone)}><ActionPayment /> </FlatButton></ListItem>
        <Divider inset={true} />
        {this.renderResourceList()}
      </List>
    </div>)
    // }
  }

}
module.exports = BuyPage