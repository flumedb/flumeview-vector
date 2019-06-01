
var Vector = require('../vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector'
//try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename, {truncate: true, readable: true, writable: true})
var v = Vector(raf)

var start = Date.now(), N = 500000

//v.alloc(32, function (err, ptr) {
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
//    console.log('done', m, n, i, _v)
//    v.dump(ptr, console.log)
    if(--m) return
    console.log("DONE", Date.now() - start)
  }


  //})
//  if(true) {
//    for(var i = 0; i < N; i++)
//      v.set(ptr, i, i, function () {
//        if(--n) return
//        console.log('done', Date.now() - start)        
//      })
//  }
//  else {
//    ;(function next (n) {
//      if(n > N) return console.log('done', Date.now() - start)
//      v.set(ptr, n, n, function () {
//        setImmediate(function () {
//          next(n+1)
//        })
//      })
//    })(0)
//  }
//})


process.on('exit', function () {
  console.log('MEM USED', MEM)
})







