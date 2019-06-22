var tape = require('tape')

var Cursor = require('../cursor')
var Vector = require('../vector')
var Polyraf = require('polyraf')
var Blocks = require('../blocks')
var filename = '/tmp/test-flumeview-vector_vector'
//try { require('fs').unlinkSync(filename) } catch (_) { }

var constants = require('../constants')

var BS = 1024
var raf = Polyraf(filename, {truncate: true, readable: true, writable: true})
var blocks = Blocks(raf, BS, constants.magic)
var v = Vector.inject(blocks, BS)

function count(vector, start, N, cb) {
  var i = 0
  ;(function next () {
    if(++i > N) return cb()
    v.append(vector, start++, function (err) {
      if(err) return cb(err)
      setImmediate(next)
    })
  })()
}

tape('alloc, set, get', function (t) {
  blocks.ready(function () {
    v.alloc(32, function (err, vector) {
      var c = new Cursor(vector, BS)
      c.init(blocks.blocks[0])
      t.equal(c.index, 0)
      t.equal(c.next(), 0)
      t.equal(c.index, 0, 'index')
      v.set(vector, 0, 1, function () {
        c.init(blocks.blocks[0])
        t.equal(c.next(), 1)
        t.equal(c.index, 1)

        count(vector, 2, 100, function (err) {
          if(err) throw err
          c.init(blocks.blocks[0])
          for(var i = 0; i < 32; i++) {
            t.equal(c.next(), i+2, 'next')
            t.equal(c.index, 2+i, 'index')
          }
          t.end()
        })
      })
    })
  })
})
