

var tape = require('tape')

var Vector = require('../raf-vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector_index'
//try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename, {truncate: true, readable: true, writable: true})
var v = Vector(raf)

tape('alloc', function (t) {
  console.log(v)
  v.alloc(32, function (err, ptr) {
    if(err) throw err
    t.equal(ptr, 4)
    t.end()
  })
})

tape('set, get', function (t) {

  v.set(4, 0, 7, function (err, value, index) {
    if(err) throw err
    t.equal(value, 4)
    t.equal(index, 0)
    v.get(4, 0, function (err, value) {
      if(err) throw err
      t.equal(value, 7)
      t.end()
    })
  })
})

tape('get, set 2', function (t) {
  v.set(4, 1, 13, function (err, value, index) {
    if(err) throw err
    t.equal(value, 4)
    t.equal(index, 1)
    v.get(4, 0, function (err, value) {
      if(err) throw err
      t.equal(value, 7)
      v.get(4, 1, function (err, value) {
        if(err) throw err
        t.equal(value, 13)
        t.end()
      })
    })
  })
})

//return

tape('alloc2', function (t) {
  v.alloc(64, function (err, ptr) {
    if(err) throw err
    t.equal(ptr, 4*(1+2+32))
    v.set(ptr, 0, 17, function (err, i) {
      if(err) throw err
      //have the first vector point to the second
      v.set(4, -1, ptr, function (err, i) {
        if(err) throw err
        console.log('set -1', i)
        v.get(4, 32, function (err, value) {
          if(err) throw err
          t.equal(value, 17)
          t.end()
        })
      })
    })
  })
})

tape('auto alloc', function (t) {
  console.log('...................')
  v.alloc(32, function (err, ptr) {
    v.set(ptr, 0, 3, function (err) {
      v.set(ptr, 32, 5, function (err, ptr2) {
        if(err) throw err
        t.notEqual(ptr2, ptr)
        v.get(ptr, 32, function (err, value) {
          t.equal(value, 5)
          t.end()
        })
      })
    })

  })
})


