class Message {
  constructor (text, t = 'text', options = {}) {
    this.messages = []
    text && this[t] && this[t](text, options)
  }

  __getPackingContent () {
    return {
      options: this.options,
      messages: this.messages
    }
  }

  option (opts) {
    if (opts) {
      this.options = this.options || {}
      let next
      if (opts.next) {
        next = Object.assign({}, this.options.next, opts.next)
      }
      Object.assign(this.options, opts)
      if (next) {
        this.options.next = next
      }
    }
    return this
  }

  requestTransfer (value) {
    if (value <= 0) {
      throw new Error(`Messsage.requestTransfer do not accept non-positive value: ${value}`)
    } else {
      return this.option({ value, nextStateAccess: 'write' })
    }
  }

  requestLocation () {
    return this.option({ location: true })
  }

  nextStateAccess (state) {
    if (!['none', 'read', 'write'].includes(state)) {
      throw new Error(`nextStateAccess must either 'none', 'read', or 'write' but got '${state}'.`)
    }
    if (this.options && this.options.value && state !== 'write') {
      throw new Error(`Cannot set nextStateAccess to '${state}' while also calling requestTransfer.`)
    }
    return this.option({ nextStateAccess: state })
  }

  updateOnEvent (eventName) {
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('Invalid event name.')
    }
    return this.option({ updateOnEvent: eventName })
  }

  updateOnTag (tagName) {
    if (!tagName || typeof tagName !== 'string') {
      throw new Error('Invalid tag name.')
    }
    return this.option({ updateOnTag: tagName })
  }

  push (message) {
    this.messages.push(message)
    return this
  }

  loading (options = {}) {
    return this.push({
      type: 'text',
      loading: true,
      ...options
    })
  }

  text (content, options = {}) {
    return this.push({
      type: 'text',
      content,
      ...options
    })
  }

  html (content, options = {}) {
    return this.push({
      type: 'html',
      content,
      ...options
    })
  }

  buttonRow () {
    const self = this
    const m = []
    const t = {
      button (text, valueOrOptions, nextOrNextState) {
        let options, next
        if (valueOrOptions) {
          if (typeof valueOrOptions === 'string') {
            options = {
              value: valueOrOptions
            }
          } else {
            options = {
              value: text,
              ...valueOrOptions
            }
          }
        } else {
          options = {
            value: text
          }
        }

        if (nextOrNextState) {
          if (typeof nextOrNextState === 'string') {
            next = {
              stateAccess: nextOrNextState
            }
          } else {
            next = nextOrNextState
          }
        }

        if (next) {
          self.option({
            next: {
              [options.value]: next
            }
          })
        }
        m.push({
          text,
          ...(options || {})
        })
        return t
      },
      buttons (...values) {
        values.forEach(v => {
          m.push({ text: v.text || v, value: v.value || v })
        })
        return t
      },
      endRow () {
        return self.push({
          type: 'button',
          content: m
        })
      }
    }

    return t
  }

  button (text, value, options = {}) {
    if (!value) value = text
    return this.push({
      type: 'button',
      content: [{
        text,
        value,
        ...options
      }]
    })
  }

  buttons (...values) {
    const m = []
    values.forEach(v => {
      m.push({ text: v.text || v, value: v.value || v })
    })
    return this.push({
      type: 'button',
      content: m
    })
  }

  input (placeholder, options = {}) {
    return this.push({
      type: 'input',
      content: {
        placeholder,
        ...options
      }
    })
  }

  select (placeholder, options = {}) {
    const self = this
    const m = {
      type: 'select',
      content: {
        placeholder,
        searchselect: false,
        multipleselect: false,
        button: {
          icon: 'check',
          label: 'OK'
        },
        options: [],
        ...options
      }
    }
    const t = {
      add (items) {
        if (!Array.isArray(items)) {
          items = [items]
        }
        items.forEach((item, index) => {
          if (typeof item === 'string') {
            m.content.options.push({ text: item, value: index })
          } else {
            m.content.options.push(item)
          }
        })
        return t
      },
      endSelect () {
        return self.push(m)
      }
    }

    return t
  }
}

Message.text = function (text, options) {
  return new Message(text, 'text', options)
}

Message.html = function (html, options) {
  return new Message(html, 'html', options)
}

Message.sendLoading = function (eventName, options) {
  return new Message().loading(options).updateOnEvent(eventName)
}

Message.create = function () {
  return new Message()
}

exports.Message = Message
