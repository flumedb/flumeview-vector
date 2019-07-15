
function CursorStream() {
  this.sink = null
  this._blocks = null
  this._resuming = false
}

CursorStream.prototype.resume = function () {
  if(this._resuming) return //prevent re-entrancy

  var self = this
  if(this.sink.paused) return

  if(!this.ready())
    return this.update(this.resume.bind(this))

  this._resuming = true
  while(!this.sink.paused && ((v = this.next()))) {
    this.sink.write(v - 1)
  }

  this._resuming = false

  if(this.isEnded()) this.sink.end()
  else if(!this.block)
    this.update(this.resume.bind(this))
}


CursorStream.prototype.pipe = function (dest) {
  this.sink = dest
  dest.source = this
  if(!dest.paused) this.resume()
  return dest
}

module.exports = CursorStream
