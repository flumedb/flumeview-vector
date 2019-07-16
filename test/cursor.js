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
  t.equal(c.next(), 0, 'next on empty cursor returns zero')
  console.log("ALLOC")
  v.set(vector, 0, 1, function (_, _vector) {
    vector = _vector
    c.init(blocks.blocks[0])
    t.equal(c.next(), 1)
    count(vector, 2, 100, function (err, vector) {
      if(err) throw err
      console.log('new vec', vector, c.index, c)
      c.init(blocks.blocks[0])
      for(var i = 0; i < 32; i++) {
        t.ok(c.ready())
        t.notOk(c.isEnded())
        t.equal(c.next(), i+2, 'next')
      }
      t.notOk(c.isEnded())
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
    while(c.ready()) v = c.next()
      ; //t.equal(v, c.index)
    t.equal(c.block_index, 1)
    t.equal(c.block, null)
    c.init(blocks.blocks[1])
    var _v = 0
    while(c.ready()) {
      t.equal(c.isEnded(), false)
      v = c.next()
      t.ok(v > _v)
      _v = v
    }
    console.log(c)
    t.equal(c.isEnded(), true, 'has ended')
    t.end()
  })
})

tape('reverse', function (t) {
  var a = [], b = []

  while(!c2.isEnded()) {
    c2.init(blocks.blocks[c2.block_index])
    while(c2.ready()) a.push(v = c2.next())
  }
  //-----------------
//  return t.end()
  var c3 = new Cursor(blocks, vector, true)
  c3.index = a.length-1
  c3.init(blocks.blocks[0])
  t.notOk(c3.ready()) //needs to seek to the first block
  t.equal(c3.block_index, 1)
  while(!c3.isEnded()) {
    c3.init(blocks.blocks[c3.block_index])
    while(c3.ready()) {
      b.push(v = c3.next())
    }
  }

  t.deepEqual(b, a.reverse())
  t.end()
})

tape('cursor stream, forward', function (t) {
  blocks.clear()
  var a = []
  var c = new Cursor(blocks, vector, false)
//  c.index = 301
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

tape('cursor stream, reverse', function (t) {
  blocks.clear()
  var a = []
  var c = new Cursor(blocks, vector, true)
  c.index = 300

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
