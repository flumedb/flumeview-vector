
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
  return block.readUInt32LE(vector + 4)
}

function set(block, vector, index, value) {
  var size = block.readUInt32LE(vector)
  if(size > index)
    return block.writeUInt32LE(value, vector+8+index*4)
  return
}

function alloc (block, size) {
  var start = block.readUInt32LE(0) || 4
  //check if there is enough room left
  var end = start + (size*4 + 8)
  if(block.length > end) {
    block.writeUInt32LE(size, start)
    block.writeUInt32LE(end, 0)
    return start
  }
  else throw new Error('insufficient space remaining in block')
}

module.exports = function (raf, block_size) {
  block_size = block_size || 65536
  var blocks = [], self

  function get_block (i, cb) {
    console.log('get_block', !!blocks[i])
    if(Buffer.isBuffer(blocks[i])) cb(null, blocks[i])
    else if(Array.isArray(blocks[i])) blocks[i].push(cb)
    //optimize case where there is only a single reader:
    else if('function' === typeof blocks[i]) blocks[i] = [blocks[i], cb]
    else {
      blocks[i] = cb
      console.log('Read new block', i)
      setTimeout(function () {
        //XXX temp, just in memory, for testing...
        var err = null, block = Buffer.alloc(block_size)
     // raf.read(i*block_size, block_size, function (err, block) {
        console.log(blocks, i, block)
        if(err) throw err
        if('function' === typeof blocks[i]) {
          var _cb = blocks[i]
          blocks[i] = block
          _cb(null, block)
        }
        else {
          var _cbs = blocks[i]
          blocks[i] = block
          for(var j = 0; j < _cbs; j++)
            _cbs[j](null, block)
        }
      })
    }
  }

  return self = {
    alloc: function (size, cb) {
      //always alloc into the last block
      var block_index = Math.max(blocks.length-1, 0)
      get_block(block_index, function (err, block) {
        cb(null, (block_index * block_size) + alloc(block, size))
      })
    },
    get: function (vector, index, cb) {
      var block_index = ~~(vector/block_size)
      //address of vector, relative to block
      var _vector = vector%block_size
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
    },
    set: function (vector, index, value, cb) {
      var block_index = ~~(vector/block_size)
      //address of vector, relative to block
      var _vector = vector%block_size
      get_block(block_index, function (err, block) {
        var _size = size(block, _vector)
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
          var free = block.readUInt32LE(0)
          if(free < block.length) {
            var max_size = ~~((block_size - free - 8)/4)
            var ptr
            //normally, double the vector size from last time
            //but if that leaves a gap smaller than the last size, expand to the rest of the space.
            //otherwise, double the previous size
            if(max_size < _size * 3)
              vector2 = alloc(block, max_size)
            else
              vector2 = alloc(block, _size*2)
            //write the next pointer in the previous vector
            block.writeUInt32LE(block_size*block_index + vector2, vector + 4)
            //call set again.
            self.set(vector2, index-_size, value, cb)
          }
          else {
            //new vector is in the next block
            throw new Error('not implemented yet')
          }
        }
      })
    },
    
  }
}



