const Big = require('big.js')

const TEA_DECIMAL = 6
const TEA_TO_MICRO = 10 ** TEA_DECIMAL

exports.toMicroUnit = function (tea) {
  return new Big(String(tea)).times(TEA_TO_MICRO).toFixed()
}

exports.toStandardUnit = function (unit) {
  return new Big(String(unit)).div(TEA_TO_MICRO).toString()
}

exports.revert = function (message) {
  throw new Error(message || 'Transaction reverted.')
}

exports.expect = function (condition, message) {
  if (!condition) {
    exports.revert(message)
  }
}

exports.validate = function (value, schema, options) {
  const { value: validatedValue, error } = schema.validate(value, options)
  if (error) {
    throw error
  }

  return validatedValue
}

// A simple msg handler, similar to ExpressJS without middleware support
exports.createMsgHandlers = (context) => {
  const handlers = {
    payable: {},
    transaction: {},
    view: {},
    pure: {},
    any: {}
  }
  return {
    ondeploy (fn) {
      handlers.__on_deployed = fn
    },
    onreceive (fn) {
      handlers.__on_received = fn
    },
    pay (name, fn) {
      handlers.payable[name] = fn
    },
    tx (name, fn) {
      handlers.transaction[name] = fn
    },
    view (name, fn) {
      handlers.view[name] = fn
    },
    pure (name, fn) {
      handlers.pure[name] = fn
    },
    any (name, fn) {
      handlers.any[name] = fn
    },
    handle () {
      const h = handlers[context.runtime.msg.callType][context.runtime.msg.name]
      if (!h) return

      return h.call(context.runtime.msg, context, ...(context.runtime.msg.params || []))
    }
  }
}

exports.stateUtil = function (context) {
  const ensureArray = p => {
    if (p == null) {
      throw new Error('Path cannot be null.')
    }
    return Array.isArray(p) ? p : [p]
  }
  const combineChild = (parent, child) => {
    if (child == null) {
      return parent
    }
    return parent.concat(child)
  }

  const bindChild = (fnName, nodePath) => {
    return (childPath, ...params) => {
      const path = combineChild(nodePath, childPath)
      return context[fnName](path, ...params)
    }
  }
  const bindSelf = (fnName, nodePath) => {
    return (...params) => {
      return context[fnName](nodePath, ...params)
    }
  }

  const seqName = name => '$seq_' + name

  const seqNext = (name, { begin = 0, step = 1 } = {}) => {
    let nextValue
    context.setState([seqName(name)], current => {
      nextValue = current == null ? begin : current + step
      return nextValue
    })
    return nextValue
  }

  const path = (name, {
    defaultValue,
    list = false,
    keyType,
    autoKey = false
  } = {}) => {
    if (keyType && !['number', 'string'].includes(keyType)) {
      throw new Error('keyType must be either "number" or "string".')
    }
    if (!list && autoKey) {
      throw new Error('autoKey cannot be true if list is false.')
    }
    if (autoKey && keyType && keyType !== 'number') {
      throw new Error('Cannot specify keyType of autoKey list.')
    }
    const nodePath = ensureArray(name)
    const r = {}
    r.currentPath = () => [...nodePath]
    r.path = (subPath, options) => {
      return path(combineChild(nodePath, subPath), options)
    }
    r.has = bindChild('hasState', nodePath)
    r.exists = bindSelf('hasState', nodePath)
    r.getKeys = () => ({ subPath, filter } = {}) => {
      return context.getStateKeys({ path: combineChild(nodePath, subPath), filter })
    }
    r.get = bindChild('getState', nodePath)
    r.set = bindChild('setState', nodePath)

    if (!list) {
      r.value = (...args) => {
        if (args.length === 0) {
          return context.getState(nodePath, defaultValue)
        } else {
          return context.setState(nodePath, ...args)
        }
      }
    } else {
      r.count = bindSelf('countState', nodePath)
      r.query = (actionGroups, options) => {
        if ((autoKey || keyType) && (options == null || !('keyType' in options))) {
          // options is frozen and cannot be extended directly
          options = Object.assign({}, options || {}, { keyType: keyType || 'number' })
        }
        return context.queryState(nodePath, actionGroups, options)
      }
      r.add = (item, options) => {
        return r.addAt(undefined, item, options)
      }

      r.addAt = (subPath, item, { id, idFieldName = 'id' } = {}) => {
        const child = combineChild(nodePath, subPath)
        id = id != null ? id : item[idFieldName]
        if (id == null) {
          if (autoKey) {
            id = seqNext(child)
          } else {
            throw new Error('Adding item error: must specify id or idFieldName for non-auto list.')
          }
        }

        const newPath = combineChild(child, id)
        if (context.hasState(newPath)) {
          throw new Error(`Adding item error: an item with ID ${id} already exists.`)
        }

        if (idFieldName in item) {
          item = { ...item }
          delete item[idFieldName]
        }

        context.setState(newPath, item)
        return id
      }
    }

    r.merge = bindSelf('mergeState', nodePath)
    r.mergeAt = bindChild('mergeState', nodePath)

    r.delete = (...keys) => {
      return context.deleteState(nodePath, keys.length ? keys.flat() : undefined)
    }

    r.deleleAt = (subPath, ...keys) => {
      return context.deleteState(combineChild(nodePath, subPath), keys.length ? keys.flat() : undefined)
    }

    return r
  }

  const define = (name, defaultValue) => path(name, { defaultValue })
  const defineList = (name, keyType) => path(name, { defaultValue: [], list: true, autoKey: false, keyType })
  const defineAutoList = name => path(name, { defaultValue: [], list: true, autoKey: true })

  const seq = (name, opts) => {
    return {
      current () {
        return context.getState([seqName(name)], opts ? opts.begin || 0 : 0)
      },
      next: () => seqNext(name, opts)
    }
  }

  return { seq, path, define, defineList, defineAutoList }
}

exports.wrapExternalContract = (contractAddress, contractLoader, methodTranslator = '_') => {
  let addr = contractAddress; let contract

  const loadContract = (addr, loader) => {
    if (!contract) {
      contract = (typeof loader === 'function' ? loader : loader.runtime.loadContract)(addr)
    }
    return contract
  }

  const translateProp = (prop, translator) => {
    if (typeof translator === 'string') {
      return translator + prop
    }

    if (typeof translator === 'function') {
      return translator(prop)
    }

    return prop
  }

  const params = {
    get contractAddress () {
      return addr
    },
    set contractAddress (newAddr) {
      addr = newAddr
      // reset contract
      contract = undefined
      return addr
    },
    contractLoader,
    methodTranslator
  }

  return new Proxy(params, {
    get (target, prop, ...args) {
      const [newTarget, newProp] = prop in params ? [params, prop] : [
        loadContract(params.contractAddress, params.contractLoader),
        translateProp(prop, params.methodTranslator)
      ]
      return Reflect.get(newTarget, newProp, ...args)
    }
  })
}
