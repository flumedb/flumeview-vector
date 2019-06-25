//okay for now just handle intersections, but not union or difference.
//I think those will need nesting...
var inherits = require('inherits')
var Cursor = require('./cursor')
var CursorStream = require('./stream')

function Intersect (blocks, vectors, reverse) {
//  if(vectors.length === 1)
//    return new Cursor(blocks, vectors[0], reverse)

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
  var matched = 0
  while(matched < cursors.length) {
    matched = 0
    for(var i = 0; i < cursors.length; i++) {
      if(!cursors[i].block) {
        this.block = false
        return 0
      }
//      if(cursor.matched) continue;

      cursor = cursors[i]
      if(cursor.isEnded()) {
        this.ended = true
        return 0 //done()
      }
      if(max == 0) {
        max = cursor.next()
        matched = 1
        //for(var k in cursors) cursors[k].mached = false
        //cursor.matched = true
      }
      else if(cursor.value > max) {
        max = cursor.value //skip over the other items now.
        //reset other matches
        //for(var k in cursors) cursors[k].mached = false
        //cursor.matched = true
        matched = 1
      }
      else if(cursor.value < max) {
        cursor.next()
        //TODO: step forward with bigger steps
      } else if(cursor.value === max) {
        //cursor.matched = true
        matched ++
      }

      if(!cursor.block) return 0
    }
//    console.log('search', matched, max, cursors.map(function (e) {
//      return [e.index, e.value]
//    }))
  }
  var value = cursors[0].value
  //after a match, iterate everything forward
  var b = false
//  console.log('match', matched, max, cursors.map(function (e) {
//    return [e.index, e.value]
//  }))
  for(var i = 0; i < cursors.length; i++) {
    cursors[i].next()
    cursors[i].matched = false
    b = b || !cursors[i].block
  }
  this.block = b
  return value
}

Intersect.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  var c = 1
  for(var i = 0; i < cursors.length; i++) {
    var cursor = cursors[i]
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
