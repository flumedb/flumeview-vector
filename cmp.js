function cmp (a, b, reverse) {
  return (a < b ? -1 : a > b ? 1 : 0) * (reverse ? -1 : 1)
}

//a > b
exports.gt = function (a, b, reverse) {
  return cmp(a, b, reverse) > 0
}
exports.lt = function (a, b, reverse) {
  return cmp(a, b, reverse) < 0
}
exports.gte = function (a, b, reverse) {
  return cmp(a, b, reverse) >= 0
}
exports.lte = function (a, b, reverse) {
  return cmp(a, b, reverse) <= 0
}

exports.cmp = cmp
