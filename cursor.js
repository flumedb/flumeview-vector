module.exports = Cursor

var Format = require('./format')

/*
  cursor which iterates over a vector.
  it doesn't do any async.
  This is to maximize determinism, which eases testing.
  also closures and stuff tend to be slower.

  

*/

function Cursor(vector, block_size, reverse) {
  this.vector = vector
  this.block = null
  this.block_size = block_size
  this.block_index = ~~(vector/block_size)
  this.index = 0
  this._size = this._start = this._next = this._prev = 0
  this.format = new Format(block_size)
  this.reverse = !!reverse
}

Cursor.prototype.init = function (block) {
  this.block = block
  var _vector = this.vector%this.block_size
  this._size = this.format.size(block, _vector)
  this._start = this.format.start(block, _vector)
  this._length = this.format.length(block, _vector)
  this._next = this.format.next(block, _vector)
  this._prev = this.format.prev(block, _vector)
  this.value = 0
}

//read the next item from the current block, shifting to the next vector
//if necessary. if the block is finished, set block to null, and update block_index
Cursor.prototype.next = function () {
  if(!this.block) throw new Error('cannot call Cursor#next because block unset')
  if(this.vector == null) throw new Error('vector is null')
  while(this.block) {
    var _index = this.index - this._start
    var _vector = this.vector%this.block_size
    //return zero if we have hit the end.
    if(this.isEnded()) return 0

    if(_index < 0) {
      //step to previous vector
      this.vector = this.format.prev(this.block, this.vector)
      this.init(this.block) //update size, next, etc, while we are in the same block.
    }
    else if(this._size <= _index) {
      //step to next vector
      this.vector = this.format.next(this.block, this.vector)
      this.init(this.block)
    }
    else {
      this.value = this.format.get(this.block, _vector, _index)
      this.index += this.reverse ? -1 : 1
      return this.value
    }

    //bail out of the loop if we need a new block
    if(~~(this.vector/this.block_size) !== this.block_index) {
      this.block_index = ~~(this.vector/this.block_size)
      this.block = null
      return 0 //value can't be 0, that means empty space.
    }
  }
}

Cursor.prototype.isEnded = function () {

  return (
    this.reverse
    ? (this.index < 0 && !this._prev)
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

Cursor.prototype.update = function (blocks, cb) {
  var async = true
  if(this.block != null) throw new Error('updated when did not need update')
  var self = this
  blocks.get(this.block_index, function (err, block) {
    async = false
    self.init(block)
    if(cb) cb()
  })
  //allow to be used sync, just for the tests....
  if(async && !cb) throw new Error('call was async, but cb not provided')
}
