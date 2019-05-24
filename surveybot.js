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
    if (options) {
      options = cloneDeep(options)
      if (options.sendback) {
        Object.assign(this, options.sendback)
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
      return Message.html(`Command <b>${command}</b> is not supported by this bot.`).done()
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

  proceed (data, collector) {
    if (!collector) {
      throw new Error('Collector is required.')
    }
    const steps = this.getSteps()
    if (!steps || !steps.length) {
      throw new Error('Steps is required.')
    }

    if (collector._step < 0 || collector._step >= steps.length) {
      throw new Error('Invalid step.')
    }

    const stepObj = steps[collector._step]
    const stepName = typeof stepObj === 'string' ? stepObj : stepObj.name
    const nextStepStateAccess = typeof stepObj === 'string' ? undefined : stepObj.nextStateAccess

    let value
    try {
      value = this.collect(data, collector, stepName)
    } catch (error) {
      return this.fail(data, collector, error, stepName)
    }

    if (collector._step >= steps.length - 1) {
      collector._step = 0
    } else {
      collector._step++
    }

    const result = this.succeed(value, collector, stepName)

    if (nextStepStateAccess && !(result.options || {}).nextStateAccess) {
      result.options = result.options || {}
      result.options.nextStateAccess = nextStepStateAccess
    }
    return result
  }

  collect (data, collector, stepName) {
    const methodName = 'collect_' + stepName
    if (this[methodName]) {
      return this[methodName](data, collector)
    }
  }

  succeed (value, collector, stepName) {
    const methodName = 'succeed_' + stepName
    if (this[methodName]) {
      return this[methodName](value, collector)
    }
  }

  fail (data, collector, error, stepName) {
    const methodName = 'fail_' + stepName
    if (this[methodName]) {
      return this[methodName](data, collector, error)
    }
  }

  onerror (err) {
    throw err
  }
}

exports.SurveyBot = SurveyBot
