const { SurveyBot } = require('./surveybot')

class MemoirSurveyBot extends SurveyBot {
  getStateAccess () {
    return 'write'
  }

  getStorageKey () {
    return 'chat.'
  }

  getChat (addr) {
    return this.getState(this.getStorageKey() + addr)
  }

  saveChat (addr, chat, result) {
    this.setState(this.getStorageKey() + addr, chat)
    return result
  }

  initChat (addr) {
    return this.setState(this.getStorageKey() + addr, {
      _step: 0
    })
  }
}

exports.MemoirSurveyBot = MemoirSurveyBot
