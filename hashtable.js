var HEADER = 8 //latest seq, count
var SEQ = 0
var COUNT = 4

function assertKey(key) {
  if(!Number.isInteger(key) && key != 0) throw new Error('key must be integer, was:'+key)
}

function getSlot(key, slots) {
  return HEADER + (key%slots) * 8
}

function insert(buffer, slots, key, value) {
  value = value | 0
  var i = key
  do {
    var slot = getSlot(i, slots)
    var _key = buffer.readUInt32LE(slot)
    var ptr = buffer.readUInt32LE(slot + 4)
    //append to vector already stored
    if(key === _key || _key == 0) {
      if(_key == 0) {
        buffer.writeUInt32LE(buffer.readUInt32LE(COUNT) + 1, COUNT)
        buffer.writeUInt32LE(key, slot)
      }
      buffer.writeUInt32LE(value, slot+4)
      return slot
    }
    else
      i++
  } while(true)
}

module.exports = function (buffer) {
  var slots, count, self
  if(buffer) {
    slots = ~~((buffer.length - HEADER) / 8)
    count = buffer.readUInt32LE(COUNT)
  }
  return self = {
    initialize: function (_buffer) {
      if(Buffer.isBuffer(_buffer)) {
        slots = ~~((_buffer.length - HEADER) / 8)
        count = _buffer.readUInt32LE(COUNT)
        buffer = _buffer
      }
      else if('number' === typeof _buffer) {
        slots = _buffer; count = 0
        buffer = Buffer.alloc(HEADER + slots*8)
      }
      self.buffer = buffer
      return self
    },
    set: function (key, value) {
      assertKey(key)
      return insert(buffer, slots, key, value)
    },
    update: function (slot, value, key) {
      if(key != undefined && buffer.readUInt32LE(slot) !== key)
        throw new Error('tried to update incorrect slot')
      buffer.writeUInt32LE(value, slot + 4)
    },
    get: function (key) {
      assertKey(key)
      var i = key
      do {
        var slot = getSlot(i, slots)
        var _key = buffer.readUInt32LE(slot)
        if(_key == 0) return 0
        else if(_key === key) return buffer.readUInt32LE(slot + 4)
        else slot = (++ i % slots) * 8
      } while(true)
    },
    rehash: function (slots2) {
      slots2 = slots2 || slots*2
      var _buffer = Buffer.alloc(HEADER + slots2*8)
      for(var i = 0; i < slots; i++) {
        var key = buffer.readUInt32LE(HEADER + i*8)
        if(key) {
          var value = buffer.readUInt32LE(HEADER + i*8 + 4)
          insert(_buffer, slots2, key ,value)
        }
      }
      self.buffer = buffer = _buffer
      slots = slots2
      return self
    },
    load: function () {
      return buffer.readUInt32LE(COUNT) / slots
    },
    buffer: buffer
  }
}
