const { cloneDeep } = require('lodash')
const { Message } = require('./message')

class SurveyBot {
  constructor () {
    this.chats = {}
  }

  botInfo () {
    const info = {
      name: this.getName(),
      stateAccess: this.getStateAccess()
    }

    if (typeof this.getDescription === 'function') {
      info.description = this.getDescription()
    }

    if (typeof this.getCommands === 'function') {
      info.commands = this.getCommands()
    }

    return info
  }

  getName () {
    throw new Error('Bot has to implement getName')
  }

  getStateAccess () {
    return 'none'
  }

  getSteps () {
    throw new Error('Bot has to implement getSteps')
  }

  getChat (addr) {
    return this.chats[addr]
  }

  initChat (addr) {
    return (this.chats[addr] = {
      _step: 0
    })
  }

  loadChat (addr, lastChat) {
    if (lastChat) return lastChat

    return this.getChat(addr)
  }

  saveChat (addr, chat, result) {
    result = result || {}
    result.sendback = this.makeSendback(addr, chat)
    return result
  }

  makeSendback (addr, chat) {
    return {
      lastChat: chat
    }
  }

  handleOptions (options) {
    if (options && options.sendback) {
      const sendback = cloneDeep(options.sendback)
      if (options.sendback) {
        Object.assign(this, sendback)
      }
    }
  }

  getStep (addr) {
    const chat = this.getChat(addr)
    return (chat || {})._step || 0
  }

  oncommand (command) {
    const methodName = 'oncommand_' + command
    if (this[methodName]) {
      return this[methodName]()
    } else {
      return Message.html(`Command <b>${command}</b> is not supported by this bot.`)
    }
  }

  oncommand_start () { // eslint-disable-line
    return this.start()
  }

  ontext (text, options) {
    try {
      text = String(text)
      this.handleOptions(options)

      const who = this.runtime.msg.sender
      const chat = this.loadChat(who, this.lastChat) || this.initChat()
      const result = this.proceed(text, chat)

      // save state back
      return this.saveChat(who, chat, result)
    } catch (err) {
      return this.onerror(err)
    }
  }

  start () {
    const who = this.runtime.msg.sender
    this.initChat(who)
    return this.ontext()
  }

  proceed (text, chatData) {
    if (!chatData) {
      throw new Error('chatData is required.')
    }
    const steps = this.getSteps()
    if (!steps || !steps.length) {
      throw new Error('Steps is required.')
    }

    if (chatData._step < 0 || chatData._step >= steps.length) {
      throw new Error('Invalid step.')
    }

    const stepObj = steps[chatData._step]
    const stepName = typeof stepObj === 'string' ? stepObj : stepObj.name
    const nextStepStateAccess = typeof stepObj === 'string' ? undefined : stepObj.nextStateAccess

    let value
    try {
      value = this.validate(text, chatData, stepName)
    } catch (error) {
      return this.retry(text, chatData, error, stepName)
    }

    if (chatData._step >= steps.length - 1) {
      chatData._step = 0
    } else {
      chatData._step++
    }

    let result = this.succeed(text, chatData, value, stepName)

    if (nextStepStateAccess && !(result.options || {}).nextStateAccess) {
      result.options = result.options || {}
      result.options.nextStateAccess = nextStepStateAccess
    }
    return result
  }

  validate (text, chatData, stepName) {
    const methodName = 'validate_' + stepName
    if (this[methodName]) {
      return this[methodName]({ text, chatData })
    }
  }

  succeed (text, chatData, value, stepName) {
    let methodName = 'after_' + stepName
    if (!this[methodName] && chatData._step === 1) {
      methodName = stepName
    }

    if (this[methodName]) {
      return this[methodName]({ text, chatData, value })
    }
  }

  retry (text, chatData, error, stepName) {
    const methodName = 'retry_' + stepName
    if (this[methodName]) {
      return this[methodName]({ text, chatData, error })
    }
  }

  onerror (err) {
    throw err
  }
}

exports.SurveyBot = SurveyBot
