const Big = require('big.js')
const Joi = require('@hapi/joi')

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
  const { value: validatedValue, error } = Joi.validate(value, schema, options)
  if (error) {
    throw error
  }

  return validatedValue
}
