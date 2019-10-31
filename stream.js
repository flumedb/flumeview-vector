'use strict'
function CursorStream(limit) {
  this.sink = null
  this._blocks = null
  this._resuming = false
  this.limit = limit || -1
}

CursorStream.prototype.resume = function () {
  var v = 0
  if(this._resuming) return //prevent re-entrancy

  var self = this
  if(this.sink.paused) return

  if(this.isEnded()) return this.sink.end()
  if(!this.ready())  {
    return this.update(this.resume.bind(this))
  }
  this._resuming = true
  while(!this.sink.paused && this.ready() && (v = this.next())) {
    if(this.limit > 0) this.limit --
    this.sink.write(v - 1)
    if(this.limit === 0) {
      //TODO clean up any substreams (for intersect and union)
      this.ended = true
      if(!this.sink.paused) this.sink.end()
      else this._resuming = false

      return
    }
  }
  this._resuming = false

  if(this.isEnded()) this.sink.end()
  else if(!this.ready() || v === 0) {
    this.update(this.resume.bind(this))
  }
}


CursorStream.prototype.pipe = require('push-stream/pipe')

module.exports = CursorStream
