var Cursor = require('./cursor')
var CursorStream = require('./stream')

function Difference (blocks, vectors, reverse, limit) {
  if(vectors.length != 2) throw new Error('difference takes exactly two inputs')
  this.a = new Cursor(blocks, v[0], reverse)
  this.b = new Cursor(blocks, v[1], reverse)
  this.value = 0
  this.ended = false
  CursorStream.call(this, limit)
  this._blocks = blocks
}

Difference.prototype = new CursorStream()

Difference.prototype.ready = function () {
  if(this.a.ready()) return this.b.ready() || this.b.isEnded()
  return false
}

Difference.prototype.next = function () {
  if(!this.ready()) throw new Error('next called when not ready')
  var loop = true
  while(loop) {
    loop = false

    //bail if we need to update either cursor
    if(!(this.a.ready() && (this.b.ready() || this.b.isEnded()))) return 0

    if(this.b.isEnded())
      this.a.next()
    else if(this.a.value < this.b.value)
      this.a.next()
    else if(this.a.value == this.b.value) {
      this.a.next(); this.b.next()
      loop = true
    }
    else if(this.a.avlue > this.b.value)
      this.b.next()
  }
  return this.a.value
}

Difference.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  if(!self.a.ready())
    self.a.update(function () {
      if(!self.b.ready())
        self.b.update(function () {
          self.ended = self.a.isEnded()
          cb()
        })
    })

//  var c = 1
//  var ended = true

//  for(var i = 0; i < cursors.length; i++) {
//    var cursor = cursors[i]
//    if(!cursor.isEnded()) ended = false
//    if(!cursor.ready() && !cursor.isEnded()) {
//      c++; cursor.update(done)
//    }
//  }
//  this.ended = ended //only ended when all cursors have ended
//  done()
//  function done (_, block) {
//    if(--c) return
//    cb()
//  }
}

Difference.prototype.isEnded = function () {
  return this.ended
}

module.exports = Difference
