
var Vector = require('../vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector'
try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename)
var v = Vector(raf)

var start = Date.now(), N = 100000

//v.alloc(32, function (err, ptr) {
  var n = N, M = 20, m = M, vectors = []
  for(var i = 0; i < M; i++) {
    console.log("I", i)
    v.alloc(32, function (err, ptr) {
      console.log('alloc', err, ptr)
      ;(function next (n) {
        if(n < N/M) return done()
        v.set(ptr, n, n, function () {
          setImmediate(function () {
            next(n+1)
          })
        })
      })(0)
    })
  }

  function done () {
    console.log('done', m)
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



