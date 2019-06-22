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
    if(++i > N) return cb(null, vector)
    v.append(vector, start++, function (err, _vector) {
      if(err) return cb(err)
      vector = _vector
      setImmediate(next)
    })
  })()
}

var vector, c, c2
tape('init', function (t) {
  blocks.ready(function () {
    v.alloc(32, function (err, _vector) {
      vector = _vector
      c = new Cursor(vector, BS)
      c2 = new Cursor(vector, BS)
      t.end()
    })
  })
})

tape('alloc, set, get', function (t) {
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

tape('more vectors', function (t) {
  count(vector, 102, 200, function (err, _vector) {
    if(err) throw err
    console.log('vector', _vector)
    c.init(blocks.blocks[0])
    var v
    while(v = c.next())
      t.equal(v, c.index)
    t.equal(c.block_index, 1)
    t.equal(c.block, null)
    c.init(blocks.blocks[1])
    while(v = c.next())
      t.equal(v, c.index)

    console.log(c)
    t.end()
  })
})

tape('reverse', function (t) {
//  c2.init(blocks.blocks[0])
  var a = [], b = []

  while(!c2.isEnded()) {
    c2.init(blocks.blocks[c2.block_index])
    while(v = c2.next()) a.push(v)
  }
//  console.log(c2)
  //-----------------
  var c3 = new Cursor(vector, BS, true)
  c3.index = a.length-1
  c3.init(blocks.blocks[0])
  var v = c3.next()
  t.equal(v, 0) //zero because the last item is not in this block.
  t.equal(c3.block_index, 1)
  while(!c3.isEnded()) {
    c3.init(blocks.blocks[c3.block_index])
    console.log('loop', c3)
    while(v = c3.next()) {
      console.log('inner', v)
      b.push(v)
    }
  }

  //t.equal(v, a.length)
  console.log('V', v)
  t.deepEqual(b, a.reverse())
  t.end()
})

//tape('seek', function (t) {
//  c4.seek(v)
//
//})
