
var Vector = require('../vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector'
//try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename, {truncate: true, readable: true, writable: true})
var v = Vector(raf)

var start = Date.now(), N = 500000

  var n = N, M = 100, m = M, vectors = []
  for(var i = 0; i < M; i++) (function (i) {
    v.alloc(32, function (err, ptr) {
      ;(function next (n, _v) {
        if(n >= N/M) return done(n, i, _v, ptr)
        v.set(ptr, n, n*i, function (err, _v) {
          setImmediate(function () {
            next(n+1, _v)
          })
        })
      })(0)
    })
  })(i)

  function done (n, i, _v, ptr) {
    if(--m) return
    console.log("DONE", Date.now() - start)
  }





