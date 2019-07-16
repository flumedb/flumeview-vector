
function CursorStream(limit) {
  this.sink = null
  this._blocks = null
  this._resuming = false
  this.limit = limit || -1
}

CursorStream.prototype.resume = function () {
  if(this._resuming) return //prevent re-entrancy

  var self = this
  if(this.sink.paused) return

  if(this.isEnded()) return this.sink.end()
  if(!this.ready())  return this.update(this.resume.bind(this))

  this._resuming = true
  while(!this.sink.paused && this.ready() && (v = this.next())) {
    this.limit --
    this.sink.write(v - 1)
    if(this.limit === 0) {
      this.ended = true
      if(!this.sink.paused) this.sink.end()
      return
    }
  }

  this._resuming = false

  if(this.isEnded()) this.sink.end()
  else if(!this.ready())
    this.update(this.resume.bind(this))
}


CursorStream.prototype.pipe = function (dest) {
  this.sink = dest
  dest.source = this
  if(!dest.paused) this.resume()
  return dest
}

module.exports = CursorStream
