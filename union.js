var Cursor = require('./cursor')
var CursorStream = require('./stream')
var cmp = require('./cmp')

function Union (blocks, vectors, reverse, limit) {
  if(vectors.length === 1) {
    return new Cursor(blocks, vectors[0], reverse, limit)
  }
  this.cursors = vectors.map(function (vector) {
    return new Cursor(blocks, vector, reverse)
  })

  this.value = 0
  this.ended = false
  this.matched = false
  this.reverse = !!reverse
  CursorStream.call(this, limit)
  this._blocks = blocks
  this.min = 0
}

Union.prototype = new CursorStream()

Union.prototype.ready = function () {
  var infinite = this.reverse ? -Infinity : Infinity
  this.min = infinite
  for(var i = 0; i < this.cursors.length; i++) {
    var cursor = this.cursors[i]
    if(!cursor.isEnded()) {
      if(!cursor.ready()) return false
      this.min = cmp.lt(cursor.value, this.min, this.reverse) ? cursor.value : this.min
    }
  }
  if(this.min == infinite) {
    this.ended = true
    return false
  }
  this.value = this.min
  return true
}

Union.prototype.next = function () {
  if(!this.ready()) throw new Error('next called when not ready')
  var min = this.min
  this.ready()
  var loop = true
  while(loop) {
    loop = false
    for(var i = 0; i < this.cursors.length; i++) {
      var cursor = this.cursors[i]
      if(!cursor.isEnded() && cmp.lte(cursor.value, min, this.reverse)) {
        if(!cursor.ready()) {
          return 0
        }
        cursor.next()
      }
    }
  }

  return this.value = min
}

Union.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  var c = 1
  var ended = true
  for(var i = 0; i < cursors.length; i++) {
    var cursor = cursors[i]
    if(!cursor.isEnded()) ended = false
    if(!cursor.ready() && !cursor.isEnded()) {
      c++; cursor.update(done)
    }
  }
  this.ended = ended //only ended when all cursors have ended
  done()
  function done (_, block) {
    if(--c) return
    self.ready() //XXX stackoverflow without this.
    cb()
  }
}

Union.prototype.isEnded = function () {
  return this.ended
}

module.exports = Union
