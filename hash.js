var bipf = require('bipf')
var varint = require('varint')

var max_32bit = Math.pow(2, 32)

function abs(v) {
  return v < 0 ? v + max_32bit : v
}

function update (v, string) {
  v = v || 5381
  v = (v * 33) ^ string.length
  for(var i = 0; i < string.length; i++)
    v = (v * 33) ^ string.charCodeAt(i)
  return abs(v)
}

function update_bipf (v, buffer, start) {
  if(!Buffer.isBuffer(buffer)) throw new Error('expected a buffer, was:'+buffer)
  var tag = varint.decode(buffer, start)
  var length = tag >> 3
  start += varint.decode.bytes
  v = v || 5381
  //hash the length (shift away the tag type, for now)
  v = (v * 33) ^ length
  for(var i = 0; i < length; i++)
    v = (v * 33) ^ buffer[start + i]
  return abs(v)
}

module.exports = function hash ([_EQ, path, value]) {
  if(_EQ != 'EQ') throw new Error('wrong query format:' + _EQ)
  var v = 0
  if(Array.isArray(path)) {
    for(var i = 0; i < path.length; i++)
      v = update(v, path[i])
  }
  else
    v = update(v, path)

  return update(v, ''+value)
}

module.exports.update = update
module.exports.update_bipf = update_bipf
