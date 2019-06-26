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
}

//inherits(Intersect, CursorStream)

Intersect.prototype = new CursorStream()

Intersect.prototype.next = function () {
  const cursors = this.cursors
  var max = 0
  //will return when hits something or needs a new block
  for(var i = 0; i < cursors.length; i++) {
    if(!cursors[i].block) return 0 //needs update
    if(cursors[i].isEnded()) {
      this.ended = true
      return 0
    }
    max = Math.max(cursors[i].value, max)
  }
  console.log('max?', max, cursors.map(function (e) { return [e.value, e.index] }))
  for(var i = 0; i < cursors.length; i++) {
    //TODO: skip forward
    while(cursors[i].value < max) {
      if(!cursors[i].next()) return 0
    }

    if(cursors[i].value > max) return 0
  }

  var value = cursors[0].value
  console.log("VALUE?", value)
  //after a match, iterate everything forward
  var b = false
  for(var i = 0; i < cursors.length; i++) {
    cursors[i].next()
    b = b || !cursors[i].block
  }
  console.log("BLOCK", this.block, b)
  this.block = b
  console.log("VALUE?", value, b, cursors.map(function (e) {
    return !!e.block
  }))
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
    if(!cursor.block) (function (cursor) {
      c++
      self._blocks.get(cursor.block_index, function (err, block) {
        cursor.init(block); done()
      })
    })(cursor)
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
