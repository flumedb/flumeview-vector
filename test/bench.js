
var Vector = require('../vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector'
try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename)
var v = Vector(raf)

var start = Date.now(), N = 10000

v.alloc(32, function (err, ptr) {
  var n = N
  if(true) {
    for(var i = 0; i < N; i++)
      v.set(ptr, i, i, function () {
        if(--n) return
        console.log('done', Date.now() - start)        
      })
  }
  else {
    ;(function next (n) {
      if(n > N) return console.log('done', Date.now() - start)
      v.set(ptr, n, n, function () {
        next(n+1)
      })
    })(0)
  }
})

