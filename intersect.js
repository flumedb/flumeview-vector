var Cursor = require('./cursor')
var CursorStream = require('./stream')

var cmp = require('./cmp')

function Intersect (blocks, cursors, reverse, limit, query) {
  this.cursors = cursors
  this.value = 0
  this.ended = false
  this.matched = false
  this.reverse = !!reverse
  CursorStream.call(this, limit)
  this._blocks = blocks
  this.max = this.reverse ? Infinity : 0
  this.query = query
}

Intersect.prototype = new CursorStream()

Intersect.prototype.ready = function () {
//  if(this.ended) return false
  this.max = 0 //this.reverse ? -Infinity : Infinity
  for(var i = 0; i < this.cursors.length; i++) {
    this.ended = this.ended || this.cursors[i].isEnded()
    if(!this.cursors[i].ready()) {
      return false
    }
    var value = this.cursors[i].value
    this.max = cmp.lt(value, this.max, this.reverse) ? value : this.max
  }

  var max = this.max, cursors = this.cursors

  var loop = true
  while(loop) {
    loop = false
    for(var i = 0; i < cursors.length; i++) {
      //TODO: skip forward, rather than just step forward.
      while(cmp.lt(cursors[i].value, max, this.reverse)) {
        cursors[i].next()
        this.ended = this.ended || cursors[i].isEnded()
        if(!cursors[i].ready()) return 0
      }

      if(cmp.gt(cursors[i].value, max, this.reverse)) {
        max = cursors[i].value
        loop = true
        break;
      }
    }
    this.value = max
  }
  return !this.ended
}

Intersect.prototype.next = function () {
  const cursors = this.cursors
  if(!this.ready()) throw new Error('next called when not ready')
//  var max = this.max
//
//  var loop = true
//  while(loop) {
//    loop = false
//    for(var i = 0; i < cursors.length; i++) {
//      //TODO: skip forward, rather than just step forward.
//      while(cmp.lt(cursors[i].value, max, this.reverse)) {
//        cursors[i].next()
//        this.ended = this.ended || cursors[i].isEnded()
//        if(!cursors[i].ready()) return 0
//      }
//
//      if(cmp.gt(cursors[i].value, max, this.reverse)) {
//        max = cursors[i].value
//        loop = true
//        break;
//      }
//    }
//  }

  var value = this.value //cursors[0].value
  for(var i = 0; i < cursors.length; i++) {
    cursors[i].next()
    this.ended = this.ended || cursors[i].isEnded()
  }

  return this.value = value
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
