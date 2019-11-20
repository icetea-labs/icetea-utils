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

exports.stateUtil = function (context) {
  const ensureArray = p => {
      if (p == null) {
          throw new Error('Child path cannot be null.')
      }
      return Array.isArray(p) ? p : [p]
  }
  
  const bindChild = (fnName, nodePath) => {
      return (childPath, ...params) => {
          const path = nodePath.concat(ensureArray(childPath))
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
  
  const path = (name, defaultValue) => {
      const nodePath = ensureArray(name)
      const r = {}
      r.has = bindChild('hasState', nodePath)
      r.exists = bindSelf('hasState', nodePath)
      r.getKeys = () => ({path, filter} = {}) => {
          if (path != null) {
              path = nodePath.concat(ensureArray(path))
          }
          return context.getStateKeys({path, filter})
      }
      r.get = bindChild('getState', nodePath)
      r.set = bindChild('setState', nodePath)
      r.value = (...args) => {
          if (args.length === 0) {
              return context.getState(nodePath, defaultValue)
          } else {
              return context.setState(nodePath, ...args)
          }
      }
      r.count = bindSelf('countState', nodePath)
      r.query = bindSelf('queryState', nodePath)
      r.merge = bindSelf('mergeState', nodePath)
      r.mergeAt = bindChild('mergeState', nodePath)
  
      r.delete = (...args) => {
          if (args.length === 0) {
              return context.deleteState(nodePath)
          } else if (args.length === 1) {
              const keysOrPath = args[0]
              if (Array.isArray(keysOrPath)) {
                  // consider it is a key array, not path
                  return context.deleteState(nodePath, keysOrPath)
              } else {
                  // a string, it does not matter keys or path anyway
                  return context.deleteState([...nodePath, keysOrPath])
              }
          } else if (args.length >= 2) {
              // To delete a path deep, one can use
              // delete(['path', 'deep'], null)
              const [path, ...rest] = args 
              return context.deleteState(nodePath.concat(ensureArray(path)), ...rest)
          }
      }
  
      r.add = item => {
          const id = seqNext(name)
          context.setState([...nodePath, id], item)
          return id
      }
  
      return r
  }
  
  const seq = (name, opts) => {
      return {
          current() {
              return context.getState([seqName(name)], begin)
          },
          next: () => seqNext(name, opts)
      }
  }

  return { seq, path }
}
