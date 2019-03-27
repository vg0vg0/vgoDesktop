const React = require('react')
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
var i18n = new (require('../../renderer/i18n'))
const { dispatch } = require('../lib/dispatcher')
const FlatButton = require('material-ui/FlatButton').default
const ContentSend = require('material-ui/svg-icons/content/send').default
const ReactPaginate = require('react-paginate')

class UnconfirmedListPage extends React.Component {
    constructor(props) {
        super(props)
        this.state = this.props.state;
    }

    handlePageClick(data) {
        var page = data.selected;
        dispatch('unconfirmedList',page + 1);
    }

    render() {
        return (<div>
            <List>
                <ListItem insetChildren={true}>{i18n.show('unconfirmed_list')} :</ListItem>
            </List>
            <Divider inset={true} />
            {this.state.unconfirmed ? this.renderTransactionList() : null}
            <Divider inset={true} />
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
        </div>)
    }

    renderTransactionList() {
        let transactionsInfo = [];
        this.state.unconfirmed.map((transaction) => {
          let item = <ListItem insetChildren={true}> {transaction.unconfirmed ? i18n.show('no') : i18n.show('yes')} | {i18n.show(transaction.type)} | {transaction.from}  -->  {transaction.to} | {transaction.amount} : {transaction.fee} |  height: {transaction.height}</ListItem>
          transactionsInfo.push(item);
        });
    
        return (<List>
          <ListItem insetChildren={true}>{i18n.show('confirmed')} | {i18n.show('tr_type')} |  {i18n.show('from')} --> {i18n.show('to')}  |  {i18n.show('amount')} : {i18n.show('fee') } | {i18n.show('height')}</ListItem>
          {
            transactionsInfo
          }
        </List>);
      }

}
module.exports = UnconfirmedListPage