const constants = require('./constants')
const MAGIC_NUMBER = constants.magic

module.exports = Format

const B_HEADER = constants.block
const V_HEADER = constants.vector
const V_NEXT = constants.next
const V_PREV = constants.prev
const V_START = constants.start
const V_LENGTH = constants.length
const FREE     = constants.free

function Format (block_size) {
  this.block_size = block_size
}

Format.prototype.get =
function get (block, vector, index) {
  var _vector = vector%this.block_size
  if(this.size(block, _vector) > index)
    return block.readUInt32LE(_vector+V_HEADER+index*4)
  return
}

Format.prototype.size =
function size (block, vector) {
  return block.readUInt32LE(vector%this.block_size)
}
Format.prototype.start =
function start (block, vector) {
  return block.readUInt32LE(vector%this.block_size + V_START)
}

Format.prototype.next =
function next (block, vector, index) {
  return block.readUInt32LE(vector%this.block_size + V_NEXT)
}

Format.prototype.prev =
function prev (block, vector, index) {
  return block.readUInt32LE(vector%this.block_size + V_PREV)
}

Format.prototype.length =
function length (block, vector, index) {
  return block.readUInt32LE(vector%this.block_size + V_LENGTH)
}

Format.prototype.set =
function set(block, vector, index, value) {
  var _vector = vector%this.block_size
  var size = block.readUInt32LE(_vector)
  var last = block.readUInt32LE(_vector+V_LENGTH)
  if(size > index) {
    block.writeUInt32LE(value, _vector+V_HEADER+index*4)
    if(index >= last)
      block.writeUInt32LE(index+1,_vector+V_LENGTH)
  }
  return
}

Format.prototype.alloc =
function alloc (block, size) {
  if(size < 1) throw new Error('size cannot be smaller than 1, was:'+size)
  var start = block.readUInt32LE(FREE) || B_HEADER
  //check if there is enough room left
  var end = start + (size*4 + V_HEADER)
  if(start >= block.length) throw new Error('invalid free pointer:'+start)
  if(block.length >= end) {
    block.writeUInt32LE(size, start) //size of this vector
    if(end > block.length) throw new Error('invalid end')
    if(end < block.length && end > block.length - V_HEADER+4)
      throw new Error('gap too small:'+end)
    block.writeUInt32LE(end, FREE)
    return start
  }
  else throw new Error('insufficient space remaining in block, remaining:' + block.length + ' requested end:'+end +', from start:'+start)
}
