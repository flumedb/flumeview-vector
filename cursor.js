module.exports = Cursor

var CursorStream = require('./stream')
var Format = require('./format')

/*
  cursor which iterates over a vector.
  it doesn't do any async.
  This is to maximize determinism, which eases testing.
  also closures and stuff tend to be slower.
*/

function Cursor(blocks, vector, reverse) {
  this.vector = vector
  this.block = null
  if(!blocks.block_size) throw new Error('block_size undefined')
  this._blocks = blocks
  this.block_size = blocks.block_size
  this.block_index = ~~(vector/blocks.block_size)
  this.index = -1
  this._size = this._start = this._next = this._prev = 0
  this.reverse = !!reverse
  this.format = new Format(blocks.block_size)
  this.matched = false //used by intersect
}

Cursor.prototype = new CursorStream()

Cursor.prototype.init = function (block) {
  this.block = block
  var BS = this._blocks.block_size
  var _vector = this.vector%this.block_size
  this._size   = this.format.size  (block, _vector, BS)
  this._start  = this.format.start (block, _vector, BS)
  this._length = this.format.length(block, _vector, BS)
  this._next   = this.format.next  (block, _vector, BS)
  this._prev   = this.format.prev  (block, _vector, BS)
  this.value = 0
}

//read the next item from the current block, shifting to the next vector
//if necessary. if the block is finished, set block to null, and update block_index
Cursor.prototype.ready = function () {
  if(!this.block) return false
  return true
}

Cursor.prototype.next = function () {
  if(!this.block) return 0 //throw new Error('cannot call Cursor#next because block unset')
  if(this._length == 0) return 0
  if(this.vector == null) throw new Error('vector is null')
  //kinda a weird loop.
  //bails out from the middle.
  //two different ways.
  while(this.ready()) {

    var _index = (this.index + 1) - this._start
    var _vector = this.vector%this.block_size
    //return zero if we have hit the end.
    if(this.isEnded()) return 0

    //previosu vector
    if(_index < 0) {
      //step to previous vector
      this.vector = this.format.prev(this.block, this.vector, this.block_size)
      //fall through to last if else to check if new vector is within block
    }
    //next vector
    else if(this._size <= _index) {
      //step to next vector
      this.vector = this.format.next(this.block, this.vector, this.block_size)
      //fall through to last if else to check if new vector is within block
    }
    //inside this vector
    else {
      this.value = this.format.get(this.block, _vector, _index, this.block_size)
      this.index += this.reverse ? -1 : 1
      return this.value
    }

    //check if block_index has changed
    if(~~(this.vector/this.block_size) !== this.block_index) {
      this.block_index = ~~(this.vector/this.block_size)
      this.block = null
      return 0 //value can't be 0, that means empty space.
    }
    else //reread next/size etc for this vector
      this.init(this.block)
  }
}

Cursor.prototype.isEnded = function () {
  return (
    this.reverse
    ? (this.index < -1 && !this._prev)
    : (this.index - this._start) >= this._length  && !this._next
  )
}

//seek to a value. either returns the index of the value
//or ~index if not present, or null if need to load the next block.
Cursor.prototype.seek = function (v) {
  //check if the next value is equal to v
  //check if the last value in current vector is equal to v
  //if last value is smaller, seek to next vector
  //if between, binary search within vector
}

Cursor.prototype.update = function (cb) {
  var async = true
  if(this.ready()) throw new Error('updated when did not need update')
  var self = this
  this._blocks.get(this.block_index, function (err, block) {
    async = false
    self.init(block)
    if(cb) cb()
  })
  //allow to be used sync, just for the tests....
  if(async && !cb) throw new Error('call was async, but cb not provided')
}
