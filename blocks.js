'use strict'
function isEmpty (o) {
  for(var k in o) return false
  return true
}

const constants = require('./constants')

const B_HEADER = constants.block
const V_HEADER = constants.vector
const FREE     = constants.free

module.exports = function (raf, block_size, magic_number) {
  if(!magic_number)
    magic_number = constants.magic
 // if(!magic_number) throw new Error('non-zero magic number must be provided')
  //todo: make blocks be a cache, not store all blocks in memory.
  var blocks = []
  var dirty = {}, _dirty, writing
  var waiting_ready = [], waiting_drain = [], self

  function ready () {
    while(waiting_ready.length) waiting_ready.shift()()
  }

  ;(function reload () {
    raf.stat(function (err, stat) {
      //get the last block. it should always be complete,
      //but raf errors if you request a partial read.
      var block_index = Math.ceil(stat.size/block_size) - 1
      if(err || stat.size == 0) {
        var block = blocks[0] = Buffer.alloc(block_size)
        blocks[0].writeUInt32LE(magic_number, 0)
        blocks[0].writeUInt32LE(self.free = B_HEADER, FREE)
        ready()
      }
      else {
        raf.read(block_index*block_size, block_size, function (err, _block) {
          if(err) throw err
          if(_block.length < block_size) {
            block = Buffer.alloc(block_size)
            _block.copy(block)
          }
          else block = _block
          if(block.readUInt32LE(0) !== magic_number) {
            //throw new Error('incorrect magic number')
            return raf.del(0, stat.size, reload)
          }

          blocks[block_index] = block
          self.free = block_index*block_size + block.readUInt32LE(FREE)
          ready()
        })
      }
    })
  })()

  var _dirty

  function write () {
    _dirty = dirty
    dirty = {}
    ;(function next () {
      for(var k in _dirty) {
        var i = +k
        delete dirty[i]
        return raf.write(block_size*i, blocks[i], function (err) {
          delete _dirty[i]
          next()
        })
      }
      //if we are here, we wrote everything.
      if(!isEmpty(dirty)) write()
      else {
        writing = false
        while(waiting_drain.length)
          waiting_drain.shift()()
      }
    })()
  }

  function queue_write () {
    if(writing) return
    writing = true
    write()
  }

  return self = {
    block_size: block_size,
    free: undefined,
    get: function (i, cb) {
      if(Buffer.isBuffer(blocks[i]))
        cb(null, blocks[i])
      else if(Array.isArray(blocks[i]))
        blocks[i].push(cb)
      //optimize case where there is only a single reader:
      else if('function' === typeof blocks[i])
        blocks[i] = [blocks[i], cb]
      else {
        if(i >= blocks.length) throw new Error('read beyond length:'+i)
        blocks[i] = cb
        raf.read(block_size*i, block_size, function (err, block) {
          if(err) throw err
          if(block.readUInt32LE(0) !== magic_number) {
            throw new Error('incorrect magic number')
            return raf.del(0, stat.size, reload)
          }

          if('function' === typeof blocks[i]) {
            var _cb = blocks[i]
            blocks[i] = block
            _cb(null, block)
          }
          else {
            var _cbs = blocks[i]
            blocks[i] = block
            for(var j = 0; j < _cbs.length; j++)
              _cbs[j](null, block)
          }
        })
      }

    },
    dirty: function (i) {
      dirty[i] = true
      //queue write...
      queue_write()
    },
    last: function () {
      //if last block is non-empty, return that
      //else allocate a new empty block.
      self.free = (blocks.length-1) * block_size + blocks[blocks.length-1].readUInt32LE(FREE)
      if(self.free % block_size)
        return ~~(self.free / block_size)
      else {
        var i = blocks.length
        blocks[i] = Buffer.alloc(block_size)
        blocks[i].writeUInt32LE(magic_number, 0)
        blocks[i].writeUInt32LE(B_HEADER, FREE)
        self.dirty(i)
        return i
      }
    },
    blocks: blocks,
    ready: function (cb) {
      if(self.free) return cb()
      else waiting_ready.push(cb)
    },
    drain: function (cb) {
      if(!writing && isEmpty(dirty)) cb()
      else waiting_drain.push(cb)
    }
  }
}
