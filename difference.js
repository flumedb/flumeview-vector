var Cursor = require('./cursor')
var CursorStream = require('./stream')

function Difference (blocks, vectors, reverse, limit) {
  if(vectors.length !== 2) throw new Error('difference takes exactly two inputs')
//  return new Cursor(blocks, vectors[0], reverse, limit)
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
  while(loop) {
    loop = false

    console.log("DIFF_N", this.a.value, this.b.value)

//    console.log('DIFF_NEXT', this.a.index, this.b.index)
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
    else if(this.a.value > this.b.value) {
      loop = true
      this.b.next()
    }
  }
  console.log("DIFF_V", this.a.value)
  return this.a.value
}

Difference.prototype.update = function (cb) {
//  console.log("D_UPDATE", this.a.block, this.b.block)
//  console.log("??", this.a.ready(), this.b.ready())
  const self = this
  const cursors = this.cursors
  if(!self.a.ready())
    self.a.update(function () {
//      console.log("A", self.a)
      if(!self.b.ready()) self.b.update(next)
      else next()
    })
  else self.b.update(next)

  function next () {
    self.ended = self.a.isEnded()
    console.log("UPDATED", self.a.ready(), self.b.ready())
    cb()
  }
}

Difference.prototype.isEnded = function () {
  return this.ended
}

module.exports = Difference
