var Cursor = require('./cursor')
var CursorStream = require('./stream')

function cmp (a, b, reverse) {
  return (a < b ? -1 : a > b ? 1 : 0) * (reverse ? -1 : 1)
}

function Intersect (blocks, vectors, reverse, limit) {
  if(vectors.length === 1) {
    return new Cursor(blocks, vectors[0], reverse, limit)
  }
  this.cursors = vectors.map(function (v) {
    return new Cursor(blocks, v, reverse)
  })

  this.value = 0
  this.ended = false
  this.matched = false
  this.reverse = !!reverse
  CursorStream.call(this, limit)
  this._blocks = blocks
  this.max = this.reverse ? Infinity : 0
}

Intersect.prototype = new CursorStream()

Intersect.prototype.ready = function () {
  this.max = 0
  for(var i = 0; i < this.cursors.length; i++) {
    if(!this.cursors[i].ready() /*|| this.cursors[i].isEnded()*/) return false
    var value = this.cursors[i].value
    this.max = cmp(value, this.max, this.reverse) < 0 ? value : this.max
  }
  return true
}

Intersect.prototype.next = function () {
  const cursors = this.cursors
  if(!this.ready()) throw new Error('next called when not ready')
  var max = this.max

  var loop = true
  while(loop) {
    loop = false
    for(var i = 0; i < cursors.length; i++) {
      //TODO: skip forward, rather than just step forward.
      while(cmp(cursors[i].value, max, this.reverse) < 0) {
        if(!cursors[i].ready()) return 0
        cursors[i].next()
      }

      if(cmp(cursors[i].value, max, this.reverse) > 0) {
        max = cursors[i].value
        loop = true
        break;
      }
    }
  }

  var value = cursors[0].value
  for(var i = 0; i < cursors.length; i++) {
    cursors[i].next()
  }

  return value
}

Intersect.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  var c = 1
  for(var i = 0; i < cursors.length; i++) {
    var cursor = cursors[i]
    if(cursor.isEnded()) {
      this.ended = true
    }
    if(!cursor.ready()) {
      c++; cursor.update(done)
    }
  }
  done()
  function done (_, block) {
    if(--c) return
    cb()
  }
}

Intersect.prototype.isEnded = function () {
  return this.ended
}

module.exports = Intersect
