const {dispatch} = require('../lib/dispatcher')
const {getAccountInfo} = require('../vgo/manager')

// Controls the UI checking for new versions of the app, prompting install
module.exports = class AccountController {
  constructor (state) {
    this.state = state
  }

  // Shows a modal saying that we have an update
  showAccount (accountId) {
    console.log('show account ' + accountId);

    getAccountInfo(accountId,(account)=>{
      if(account)
        state.account = account;
      //
      state.location.go({
        url: 'account'
      })
    })    
  }

}
