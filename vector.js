'use strict'
var Blocks = require('./blocks')
//reads data in blocks, into memory.
//creates vectors in that, always keeping any vector
//within a block.

function get (block, vector, index) {
  if(size(block, vector) > index)
    return block.readUInt32LE(vector+8+index*4)
  return
}

function size (block, vector) {
  return block.readUInt32LE(vector)
}

function next (block, vector, index) {
//  console.log("next", vector + 4)
  return block.readUInt32LE(vector + 4)
}

function set(block, vector, index, value) {
  var size = block.readUInt32LE(vector)
  if(size > index)
    return block.writeUInt32LE(value, vector+8+index*4)
  return
}

function alloc (block, size) {
  if(size < 1) throw new Error('size cannot be smaller than 1, was:'+size)
  var start = block.readUInt32LE(0) || 4
  //check if there is enough room left
  var end = start + (size*4 + 8)
  //console.log('alloc size', size, MEM += size*4+8)
  if(start >= block.length) throw new Error('invalid free pointer:'+start)
  if(block.length >= end) {
  //  console.log("START,END,SIZE", start, end, size)
    block.writeUInt32LE(size, start)
    if(end > block.length) throw new Error('invalid end')
    if(end < block.length && end > block.length - 12)
      throw new Error('gap too small:'+end)
    block.writeUInt32LE(end, 0)
    return start
  }
  else throw new Error('insufficient space remaining in block, remaining:' + block.length + ' requested end:'+end +', from start:'+start)
}

function alloc_new (blocks, size) {
  if(!size) throw new Error('invalid size:'+size)
  //always alloc into the last block
  var block_index = blocks.last()
  var block_size = blocks.block_size
  var block = blocks.blocks[block_index]
  var free = block.readUInt32LE(0) || 4
  if(free == block_size) {
    return blocks.get(block_index = blocks.last(), next)
  }
  var _size = ~~(size/2)
  var max_size = (block_size - (free + 8)) / 4

  var new_size = max_size < _size * 3 ? max_size : _size*2
  if(new_size <= 0)
    throw new Error('size too small, size:'+size+' free:'+free)
  var block_start = (block_index * block_size)
  var _vector2 = alloc(block, new_size)
  var vector2 = block_start + _vector2
  blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(0))
  return vector2
}

function alloc_append(blocks, vector) {
  var block_size = blocks.block_size
  var block_index = ~~(vector/block_size)
  //address of vector, relative to block
  var _vector = vector%block_size
  var block = blocks.blocks[~~(vector/block_size)]
  var _size = size(block, _vector)

  // always fill one block before going to the next one.
  // to avoid leaving small allocations at the end of a block,
  // if an allocation will leave a smallish space, increase it's size to fill the block.
  // normally, double the size of the vector from last time, but sometimes tripple it
  // to fill the block.

  // if there is no space remaining in the block, next size is doubled, and allocation
  // happens in a new block.

  var free = block.readUInt32LE(0) || 4
  var remaining = ~~((block_size - free - 8)/4)
  var vector2 = alloc_new(blocks, (remaining > 0 && remaining < _size * 3 ? remaining : _size*2))
  //write the next pointer in the previous vector
  block.writeUInt32LE(vector2, _vector + 4)
  //block.writeUInt32LE(vector2, _vector + 4)
  return vector2
}

module.exports = function (raf, block_size) {
  block_size = block_size || 65536
  var self
  var blocks = Blocks(raf, block_size)

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
          if(!block.readUInt32LE(0)) throw new Error('block missing free pointer')
          var _size = size(block, _vector)
          if(!_size) throw new Error('zero size vector '+_vector)
          var _next = next(block, _vector)
          if(_size > index) {
            set(block, _vector, index, value)
            cb(null, vector, index)
          }
          else if(_next) {
            //TODO: optimize for case where next is within this same block
            self.set(_next, index - _size, value, cb)
          }
          else {
            if(false) {
            var free = block.readUInt32LE(0) || 4
            var remaining = ~~((block_size - free - 8)/4)

            var vector2 = alloc_new(blocks, (remaining > 0 && remaining < _size * 3 ? remaining : _size*2))
            //write the next pointer in the previous vector
            block.writeUInt32LE(vector2, _vector + 4)

            //call set again.
            }
            else
              var vector2 = alloc_append(blocks, vector, _size)
            self.set(vector2, index - _size, value, cb)
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
    }
  }
}

