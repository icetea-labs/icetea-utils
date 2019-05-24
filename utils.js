const Big = require('big.js')

const TEA_DECIMAL = 6
const TEA_TO_MICRO = 10 ** TEA_DECIMAL

exports.toUnit = function (tea) {
  return new Big(String(tea)).times(TEA_TO_MICRO).toFixed()
}

exports.toTEA = function (unit) {
  return new Big(String(unit)).div(TEA_TO_MICRO).toString()
}
