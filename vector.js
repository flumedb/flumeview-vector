'use strict'
var Blocks = require('./blocks')
var Stream = require('./stream')
//reads data in blocks, into memory.
//creates vectors in that, always keeping any vector
//within a block.

var Format = require('./format')

const constants    = require('./constants')
const MAGIC_NUMBER = constants.magic
const FREE     = constants.free
const B_HEADER = constants.block
const V_HEADER = constants.vector
const V_PREV   = constants.prev
const V_START  = constants.start

//allocate a new root vector, requested size, little smaller if necessary to fit into block.
function alloc_new (blocks, _size, prev_vector, start, format) {
  //if(!size) throw new Error('invalid size:'+size)
  //always alloc into the last block
  var block_index = blocks.last()
  var block_size = blocks.block_size
  var block_start = (block_index * block_size)
  var block = blocks.blocks[block_index]
  var free = block.readUInt32LE(FREE) || B_HEADER

  var max_size = (block_size - (free + V_HEADER)) / 4
  //+2 because that is enough room for the header of a vector.
  var new_size = max_size <= _size * 1.5  ? max_size : _size
  var vector2 = block_start + format.alloc(block, new_size)

  block.writeUInt32LE(prev_vector, vector2%block_size + V_PREV)
  block.writeUInt32LE(start, vector2%block_size + V_START)

  //if(new_size < 32) console.error('small vector:'+new_size+', after:'+_size)
  blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(FREE))
  blocks.dirty(block_index)
  return vector2
}

//append a vector, including updating pointer from previous vector
function alloc_append(blocks, vector, format) {
  var block_size = blocks.block_size
  var block_index = ~~(vector/block_size)
  //address of vector, relative to block
  var _vector = vector%block_size
  var block_index = ~~(vector/block_size)
  var block = blocks.blocks[block_index]
  if(!block) throw new Error('block:'+block_index+' was not ready before calling alloc_append')
  var _size = format.size(block, _vector)

  // always fill one block before going to the next one.
  // to avoid leaving small allocations at the end of a block,
  // if an allocation will leave a smallish space, increase it's size to fill the block.
  // normally, double the size of the vector from last time, but sometimes tripple it
  // to fill the block.

  // if there is no space remaining in the block, next size is doubled, and allocation
  // happens in a new block.

  var free = block.readUInt32LE(FREE) || B_HEADER
  var vector2 = alloc_new(blocks, _size*2, vector, format.start(block, _vector) + _size, format)
  //write the next pointer in the previous vector
  block.writeUInt32LE(vector2, _vector + 4)
  blocks.dirty(block_index)

  return vector2
}

function inject (blocks, block_size) {
  block_size = block_size || 65536
  var format = new Format(block_size)
  var self

  return self = {
    ready: blocks.ready,
    alloc: function (size, cb) {
      blocks.ready(function () {
        cb(null, alloc_new(blocks, size, 0, 0, format))
      })
    },
    get: function (vector, index, cb) {
      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
        blocks.get(block_index, function (err, block) {
          if(err) return cb(err)
          var _size = format.size(block, _vector)
          var _start = format.start(block, _vector)
          var _next = format.next(block, _vector)
          var _prev = format.prev(block, _vector)
          var _index = index - _start
          if(_index < 0) {
            self.get(_prev, index, cb)
          }
          else if(_size > _index) cb(null, format.get(block, _vector, _index))
          else if(_next) {
            //TODO: optimize for case where next is within this same block
            self.get(_next, index, cb)
          }
          else cb(new Error('not found'))
        })
      })
    },
    set: function (vector, index, value, cb) {
      if(vector == 0) return cb(new Error('cannot set to from null vector:'+vector))
      if(index < 0) return cb(new Error('index' + index + ' must be >= 0'))

      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
        blocks.get(block_index, function (err, block) {
          if(!block.readUInt32LE(FREE)) throw new Error('block missing free pointer')
          var _start = format.start(block, _vector)
          var _next, _size = format.size(block, _vector)
          var _index = index - _start
          if(!_size) throw new Error('zero size vector '+_vector)

          if(_index < 0)
            self.set(format.prev(block, _vector), index, value, cb)
          else if(_size > _index) {
            format.set(block, _vector, _index, value)
            blocks.dirty(block_index)
            cb(null, vector, index)
          }
          else if(_next = format.next(block, _vector)) {
            //TODO: optimize for case where next is within this same block
            self.set(_next, index, value, cb)
          }
          else {
            self.set(alloc_append(blocks, vector, format), index, value, cb)
          }
        })
      })
    },
    length: function (vector, cb) {
      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        blocks.get(block_index, function (err, block) {
          var _vector = vector%block_size
          var _next = format.next(block, _vector)
          if(_next) return self.length(_next, cb)
          else cb(null, format.start(block, _vector) + format.length(block, _vector))
        })
      })
    },
    //add a value to the end of a vector. much like [].push()
    append: function (vector, value, cb) {
      self.length(vector, function (err, i) {
        if(err) cb(err)
        else self.set(vector, i, value, cb)
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
          var _size = format.size(block, _vector)
          var _next = format.next(block, _vector)
          data.push({id: vector, size: _size, next: _next, block: ~~(vector/block_size)})
          if(_next)
            dump(_next)
          else
            cb(null, data)
        })
      })(vector)
    },
    drain: blocks.drain,
    stream: function (opts) {
      return new Stream(opts, self)
    }
  }
}

module.exports = function (raf, block_size) {
  block_size = block_size || 65536
  var blocks = Blocks(raf, block_size, MAGIC_NUMBER)
  return inject(blocks, block_size)
}

module.exports.inject = inject
