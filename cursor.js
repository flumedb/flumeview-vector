module.exports = Cursor

var Format = require('./format')

function Cursor(vector, block_size) {
  this.vector = vector
  this.block = null
  this.block_size = block_size
  this.block_index = ~~(vector/block_size)
  this.index = 0
  this._size = this._start = this._next = this._prev = 0
  this.format = new Format(block_size)
}

Cursor.prototype.init = function (block) {
  this.block = block
  var _vector = this.vector%this.block_size
  this._size = this.format.size(block, _vector)
  this._start = this.format.start(block, _vector)
  this._length = this.format.length(block, _vector)
  this._next = this.format.next(block, _vector)
  this._prev = this.format.prev(block, _vector)
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
    if(_index >= this._length && !this._next) return 0

    if(_index < 0) {
      //step to previous vector
      this.vector = this.format.prev(this.block, this.vector)
    }
    else if(this._size <= _index) {
      //step to next vector
      this.vector = this.format.next(this.block, this.vector)
    }
    else {
      var value = this.format.get(this.block, _vector, _index)
      this.index += this.reverse ? -1 : 1
      return value
    }

    //bail out of the loop if 
    if(~~(this.vector/this.block_size) !== this.block_index) {
      this.block_index = ~~(this.vector/this.block_size)
      return 0 //value can't be 0, that means empty space.
    }
    this.init(this.block) //update size, next, etc, while we are in the same block.
  }
}

//seek to a value. either returns the index of the value
//or ~index if not present, or null if need to load the next block.
Cursor.prototype.seek = function (v) {

}
