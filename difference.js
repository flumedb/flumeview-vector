var Cursor = require('./cursor')
var CursorStream = require('./stream')

function Difference (blocks, vectors, reverse, limit) {
  if(vectors.length !== 2) throw new Error('difference takes exactly two inputs')
  this.a = new Cursor(blocks, vectors[0], reverse)
  this.b = new Cursor(blocks, vectors[1], reverse)
  this.value = 0
  this.ended = false
  CursorStream.call(this, limit)
  this._blocks = blocks
}

Difference.prototype = new CursorStream()

Difference.prototype.ready = function () {
  if(this.a.ready()) return this.b.ready() || this.b.isEnded()
  this.value = this.a.value
  return false
}

Difference.prototype.next = function () {
  if(!this.ready()) throw new Error('next called when not ready')
  var loop = true
  this.value = 0
  while(loop) {
    loop = false

    //bail if we need to update either cursor
    if(
      !this.a.ready() ||
      (!this.b.ready() && !this.b.isEnded())
    ) return 0

    if(this.b.isEnded()) {
      this.a.next()
      this.value = this.a.value
    }
    else if(this.a.value < this.b.value) {
      this.value = this.a.value
      this.a.next()
      return this.value
    }
    else if(this.a.value == this.b.value) {
      this.a.next(); this.b.next()
      loop = true
    }
    else if(this.a.value > this.b.value) {
      loop = true
      this.b.next()
    }
  }
  return this.value// = this.a.value
}

Difference.prototype.update = function (cb) {
  const self = this
  const cursors = this.cursors
  if(!self.a.ready())
    self.a.update(function () {
      if(!self.b.ready()) self.b.update(next)
      else next()
    })
  else self.b.update(next)

  function next () {
    self.ended = self.a.isEnded(); cb()
  }
}

Difference.prototype.isEnded = function () {
  return this.ended
}

module.exports = Difference
