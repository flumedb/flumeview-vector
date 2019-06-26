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
      c = new Cursor(blocks, vector)
      c2 = new Cursor(blocks, vector)
      t.end()
    })
  })
})

tape('alloc, set, get', function (t) {
  console.log("ALLOC?")
  //t.equal(c.index, 0, 'empty index is zero')
  c.init(blocks.blocks[0])
//  t.ok(c.isEnded(), 'an empty cursor has already ended')
  t.equal(c.index, -1, 'index')
  t.equal(c.next(), 0, 'next on empty cursor returns zero')
  //t.ok(c.isEnded(), 'an empty cursor has already ended')
  t.equal(c.index, -1, 'index')
  console.log("ALLOC")
  v.set(vector, 0, 1, function () {
    c.init(blocks.blocks[0])
    t.equal(c.next(), 1)
    //t.equal(c.index, 1)
    console.log("SET")
    //return t.end()
    count(vector, 2, 100, function (err) {
      if(err) throw err
      c.init(blocks.blocks[0])
      for(var i = 0; i < 32; i++) {
        t.notOk(c.isEnded())
        t.equal(c.next(), i+2, 'next')
  //      t.equal(c.index, i+2, 'index')
      }
      t.notOk(c.isEnded())
      t.end()
    })
  })
})

//return
tape('more vectors', function (t) {
  count(vector, 102, 200, function (err, _vector) {
    if(err) throw err
    console.log('vector', _vector)
    c.init(blocks.blocks[0])
    var v
    while(v = c.next())
      ; //t.equal(v, c.index)
    t.equal(c.block_index, 1)
    t.equal(c.block, null)
    c.init(blocks.blocks[1])
    var _v = 0
    while(v = c.next()) {
      t.ok(v > _v)
      _v = v
      t.equal(c.isEnded(), false)
    }
    console.log(c)
    t.equal(c.isEnded(), true, 'has ended')
    t.end()
  })
})
//return
tape('reverse', function (t) {
  var a = [], b = []

  while(!c2.isEnded()) {
    c2.init(blocks.blocks[c2.block_index])
    while(v = c2.next()) a.push(v)
  }
  //-----------------
  var c3 = new Cursor(blocks, vector, true)
  c3.index = a.length-1
  c3.init(blocks.blocks[0])
  var v = c3.next()
  t.equal(v, 0) //zero because the last item is not in this block.
  t.equal(c3.block_index, 1)
  while(!c3.isEnded()) {
    c3.init(blocks.blocks[c3.block_index])
    while(v = c3.next()) {
      b.push(v)
    }
  }

  t.deepEqual(b, a.reverse())
  t.end()
})

tape('read', function (t) {
  blocks.clear()
  var a = []
  var c = new Cursor(blocks, vector, false)
  c.pipe({
    write: function (data) {
      a.push(data)
    },
    end: function () {
      t.ok(a.length)
      t.equal(a.length, 301)
      t.end()
    }
  })
})
