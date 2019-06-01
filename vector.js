var Blocks = require('./blocks')
//reads data in blocks, into memory.
//creates vectors in that, always keeping any vector
//within a block.

MEM = 0

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
  MEM += size*4+8
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

module.exports = function (raf, block_size) {
  block_size = block_size || 65536
  var self
  var blocks = Blocks(raf, block_size)

  function get_block (i, cb) {
    blocks.get(i, cb)
//    if(Buffer.isBuffer(blocks[i])) cb(null, blocks[i])
//    else if(Array.isArray(blocks[i])) blocks[i].push(cb)
//    //optimize case where there is only a single reader:
//    else if('function' === typeof blocks[i]) blocks[i] = [blocks[i], cb]
//    else {
//      blocks[i] = cb
//      setTimeout(function () {
//        //XXX temp, just in memory, for testing...
//        var err = null, block = Buffer.alloc(block_size)
//        if(err) throw err
//        if('function' === typeof blocks[i]) {
//          var _cb = blocks[i]
//          blocks[i] = block
//          _cb(null, block)
//        }
//        else {
//          var _cbs = blocks[i]
//          blocks[i] = block
//          for(var j = 0; j < _cbs.length; j++)
//            _cbs[j](null, block)
//        }
//      })
//    }
  }

  return self = {
    ready: blocks.ready,
    alloc: function (size, cb) {
      blocks.ready(function () {
        if(!size) throw new Error('invalid size:'+size)
        //always alloc into the last block
        var block_index = blocks.last()
//        console.log("BLOCK FOR ALLOC", block_index)
        get_block(block_index, function next (err, block) {
    //      if(Math.max(blocks.length-1, 0) != block_index)
      //      return self.alloc(size, cb)
          var free = block.readUInt32LE(0) || 4
//          console.log("FREE", free, block_index)
          if(free == block_size) {
            return get_block(block_index = blocks.last(), next)
          }
          var _size = ~~(size/2)
          var max_size = (block_size - (free + 8)) / 4

          var new_size = max_size < _size * 3 ? max_size : _size*2
          if(new_size <= 0)
            throw new Error('size too small, size:'+size+' remaining_size:'+remaining_size+' free:'+free)
          var block_start = (block_index * block_size)
          var _vector2 = alloc(block, new_size)
//          console.log('bs', block_start, _vector2)

          vector2 = block_start + _vector2
//          console.log(vector2, block.readUInt32LE(_vector2+4), block.readUInt32LE(_vector2), block)
          blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(0))
          cb(null, vector2)
        })
      })
    },
    get: function (vector, index, cb) {
      blocks.ready(function () {
        var block_index = ~~(vector/block_size)
        //address of vector, relative to block
        var _vector = vector%block_size
  //      console.log("GET", block_index, vector)
        get_block(block_index, function (err, block) {
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
    //    console.log("SET", vector, block_index)
        get_block(block_index, function (err, block) {
          if(!block.readUInt32LE(0)) throw new Error('block missing free pointer')
          var _size = size(block, _vector)
      //    console.log('size', _size)
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
            //alloc a vector. double the size of previous
            //or up to the rest of the block. all ways
            //fill a block before moving to next block
            //(sometimes will get a small vector at end)

            //if a new vector will leave a too-small
            //gap at the end, just make this vector
            //bigger.

            //remaining space (within block) always written at start of block.
            var free = block.readUInt32LE(0) || 4
            if(free < block_size) {
              var max_size = ~~((block_size - free - 8)/4)
              var ptr
              //normally, double the vector size from last time
              //but if that leaves a gap smaller than the last size, expand to the rest of the space.
              //otherwise, double the previous size
              var block_start = (block_index * block_size)
                vector2 = block_start + alloc(block, max_size < _size * 3 ? max_size : _size*2)
              blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(0))

              //write the next pointer in the previous vector
              block.writeUInt32LE(vector2, _vector + 4)
              //call set again.
              self.set(vector2, index-_size, value, cb)
            }
            else {
              var block_start = block_size*(block_index+1)
              self.alloc(_size*2, function (err, vector2) {
                if(err) cb(err)
                else {
                  blocks.free = Math.max(blocks.free, block_start + block.readUInt32LE(0))
                  block.writeUInt32LE(vector2, _vector + 4)
                  self.set(vector2, index - _size, value, cb)
                }
              })
            }
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
        get_block(block_index, function (err, block) {
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

