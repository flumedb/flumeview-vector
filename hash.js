var _hash  = require('string-hash')

module.exports = function hash ([_EQ, path, value]) {
  if(_EQ != 'EQ') throw new Error('wrong query format:' + _EQ)
  path = (Array.isArray(path) ? path.join('.') : path)
  return _hash('.'+path+':' + value)
}
