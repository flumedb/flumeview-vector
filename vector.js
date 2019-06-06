'use strict'
var Blocks = require('./blocks')
//reads data in blocks, into memory.
//creates vectors in that, always keeping any vector
//within a block.

/*
  current design:
    <vector: <size><next><data...>>

  you always point to the first vector, then just log(n) vectors along to find the index.
  since for the clock index, I certainly expect you would read the latest clocks more frequently,
  it would be better to have a doubly linked list of vectors, and point to the last one.

  better design:
    <vector: <size><start><prev><next><data...>>

  start is necessary becaus when you land on the vector, looking for a particular index
  you need to know wether you should seek forward or backward.

*/

const constants = require('./constants')
const MAGIC_NUMBER = constants.magic

const B_HEADER = constants.block
const V_HEADER = constants.vector
const FREE     = constants.free

function get (block, vector, index) {
  if(size(block, vector) > index)
    return block.readUInt32LE(vector+V_HEADER+index*4)
  return
}

function size (block, vector) {
  return block.readUInt32LE(vector)
}

function next (block, vector, index) {
  return block.readUInt32LE(vector + 4)
}

function set(block, vector, index, value) {
  var size = block.readUInt32LE(vector)
  if(size > index)
    return block.writeUInt32LE(value, vector+V_HEADER+index*4)
  return
}

function alloc (block, size) {
  if(size < 1) throw new Error('size cannot be smaller than 1, was:'+size)
  var start = block.readUInt32LE(FREE) || B_HEADER
  //check if there is enough room left
  var end = start + (size*4 + V_HEADER)
  //console.log('alloc size', size, MEM += size*4+V_HEADER)
  if(start >= block.length) throw new Error('invalid free pointer:'+start)
  if(block.length >= end) {
  //  console.log("START,END,SIZE", start, end, size)
    block.writeUInt32LE(size, start)
    if(end > block.length) throw new Error('invalid end')
    if(end < block.length && end > block.length - V_HEADER+4)
      throw new Error('gap too small:'+end)
    block.writeUInt32LE(end, FREE)
    return start
  }
  else throw new Error('insufficient space remaining in block, remaining:' + block.length + ' requested end:'+end +', from start:'+start)
}


//allocate a new root vector, requested size, little smaller if necessary to fit into block.
function alloc_new (blocks, _size) {
  if(!size) throw new Error('invalid size:'+size)
  //always alloc into the last block
  var block_index = blocks.last()
  var block_size = blocks.block_size
  var block_start = (block_index * block_size)
  var block = blocks.blocks[block_index]
  var free = block.readUInt32LE(FREE) || B_HEADER

  var max_size = (block_size - (free + V_HEADER)) / 4
  //+2 because that is enough room for the header of a vector.
  var new_size = max_size <= _size * 1.5  ? max_size : _size
  var vector2 = block_start + alloc(block, new_size)
  if(new_size < 32) console.error('small vector:'+new_size+', after:'+_size)
  blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(FREE))
  blocks.dirty(block_index)
  return vector2
}

//append a vector, including updating pointer from previous vector
function alloc_append(blocks, vector) {
  var block_size = blocks.block_size
  var block_index = ~~(vector/block_size)
  //address of vector, relative to block
  var _vector = vector%block_size
  var block_index = ~~(vector/block_size)
  var block = blocks.blocks[block_index]
  if(!block) throw new Error('block:'+block_index+' was not ready before calling alloc_append')
  var _size = size(block, _vector)

  // always fill one block before going to the next one.
  // to avoid leaving small allocations at the end of a block,
  // if an allocation will leave a smallish space, increase it's size to fill the block.
  // normally, double the size of the vector from last time, but sometimes tripple it
  // to fill the block.

  // if there is no space remaining in the block, next size is doubled, and allocation
  // happens in a new block.

  var free = block.readUInt32LE(FREE) || B_HEADER
  var vector2 = alloc_new(blocks, _size*2)
  //write the next pointer in the previous vector
  block.writeUInt32LE(vector2, _vector + 4)
  blocks.dirty(block_index)

  return vector2
}

module.exports = function (raf, block_size) {
  block_size = block_size || 65536
  var self
  var blocks = Blocks(raf, block_size, MAGIC_NUMBER)

  return self = {
    ready: blocks.ready,
    alloc: function (size, cb) {
      blocks.ready(function () {
        cb(null, alloc_new(blocks, size))
      })
    },
    get: function (vector, index, cb) {
      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
        blocks.get(block_index, function (err, block) {
          var _size = size(block, _vector)
          var _next = next(block, _vector)
          if(_size > index) cb(null, get(block, _vector, index))
          else if(_next) {
            //TODO: optimize for case where next is within this same block
            self.get(_next, index - _size, cb)
          }
          else cb(new Error('not found'))
        })
      })
    },
    set: function (vector, index, value, cb) {
      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
        blocks.get(block_index, function (err, block) {
          if(!block.readUInt32LE(FREE)) throw new Error('block missing free pointer')
          var _size = size(block, _vector)
          if(!_size) throw new Error('zero size vector '+_vector)
          var _next = next(block, _vector)
          if(_size > index) {
            set(block, _vector, index, value)
            blocks.dirty(block_index)
            cb(null, vector, index)
          }
          else if(_next) {
            //TODO: optimize for case where next is within this same block
            self.set(_next, index - _size, value, cb)
          }
          else {
            self.set(alloc_append(blocks, vector, _size), index - _size, value, cb)
          }
        })
      })
    },
    size: function (cb) {
      cb(null, blocks.length * block_size)
    },
    dump: function (vector, cb) {
      var data = []
      ;(function dump (vector) {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
        blocks.get(block_index, function (err, block) {
          var _size = size(block, _vector)
          var _next = next(block, _vector)
          data.push({id: vector, size: _size, next: _next, block: ~~(vector/block_size)})
          if(_next)
            dump(_next)
          else
            cb(null, data)
        })
      })(vector)
    },
    drain: blocks.drain
  }
}

