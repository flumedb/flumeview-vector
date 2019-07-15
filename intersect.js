//okay for now just handle intersections, but not union or difference.
//I think those will need nesting...
var inherits = require('inherits')
var Cursor = require('./cursor')
var CursorStream = require('./stream')

function Intersect (blocks, vectors, reverse) {
  if(vectors.length === 1)
    return new Cursor(blocks, vectors[0], reverse)

  this.cursors = vectors.map(function (v) {
    return new Cursor(blocks, v, reverse)
  })

  this.block = false
  this.value = 0
  this.ended = false
  this.matched = false
  CursorStream.call(this)
  this._blocks = blocks
  this.max = 0
}

//inherits(Intersect, CursorStream)

Intersect.prototype = new CursorStream()

Intersect.prototype.ready = function () {
  this.max = 0
  for(var i = 0; i < this.cursors.length; i++) {
    if(!this.cursors[i].ready()) return false
    this.max = Math.max(this.cursors[i].value, this.max)
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
      //TODO: skip forward
      while(cursors[i].value < max) {
        if(cursors[i].next() == 0) {
          console.log('hit edge', !!cursors[i].block)
          this.block = false
          return 0
        }
      }

      if(cursors[i].value > max) {
        max = cursors[i].value
//        console.log("new max", cursors[i].value)
        break;
        //return 0
      }
    }
  }

  var value = cursors[0].value

  var b = true
  for(var i = 0; i < cursors.length; i++) {
    cursors[i].next()
    b = b && !!cursors[i].block
  }
  this.block = value === 0 ? false : b

  return value
}

Intersect.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  console.log('update?', this.cursors.map(function (e) {
    return e.isEnded()
  }))
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
