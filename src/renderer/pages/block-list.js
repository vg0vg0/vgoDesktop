const React = require('react')
const Divider = require('material-ui/Divider').default
const { List, ListItem } = require('material-ui/List')
var i18n = new (require('../../renderer/i18n'))
const { dispatch } = require('../lib/dispatcher')
const FlatButton = require('material-ui/FlatButton').default
const ContentSend = require('material-ui/svg-icons/content/send').default
const ReactPaginate = require('react-paginate')

class BlockListPage extends React.Component {
    constructor(props) {
        super(props)
        this.state = this.props.state;
    }

    handlePageClick(data) {
        var page = data.selected;
        dispatch('blockList',page + 1);
    }

    render() {
        return (<div>
            <List>
                <ListItem insetChildren={true}>{i18n.show('vgo_block_list')} :</ListItem>
            </List>
            <Divider inset={true} />
            {this.state.blocks ? this.renderBlockList() : null}
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

    renderBlockList() {
        let blockList = [];
        let header = <ListItem insetChildren={true}>{i18n.show('height')}  | {i18n.show('b_generatorId')} |  {i18n.show('b_amount')} | {i18n.show('b_fee')} | {i18n.show('b_difficulty')} | {i18n.show('b_time')} </ListItem>
        blockList.push(header);
        this.state.blocks.map((block) => {
            let dat = new Date(block.time);
            let btime = dat.toString();
            let item = <ListItem insetChildren={true}> {block.height} | {block.generatorId} | {block.amount} | {block.fee} | {block.difficulty} | {btime}</ListItem>
            blockList.push(item);
        });
        return (<List>
            {
                blockList
            }
        </List>);
    }

}
module.exports = BlockListPage