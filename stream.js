
function CursorStream() {
  this.sink = null
  this._blocks = null
}

CursorStream.prototype.resume = function () {
  var self = this
  if(this.sink.paused) return
  while(!this.sink.paused && (v = this.next()))
    this.sink.write(v)

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
