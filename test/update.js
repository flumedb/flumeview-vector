var Flume    = require('flumedb')
var tape     = require('tape')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
//note: using this function quite a few values get collisions.
//too many, really.
var hash     = require('string-hash')
var Reduce   = require('flumeview-reduce')
var bipf     = require('bipf')
var pull     = require('pull-stream')
var RNG      = require('rng')

//var Values   = require('../../push-stream/sources/values')
//var Collect  = require('../../push-stream/sinks/collect')
//var AsyncMap = require('../../push-stream/throughs/async-map')

var N = 10000, Q = 100, start = Date.now()

var dir = '/tmp/test_flumeview-vector_update'
rimraf.sync(dir)

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024,
}))

var FlumeViewVector = require('../')

function encode (value) {
  var b = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, b)
  return b
}
var _foo = Buffer.from('foo')
var _bar = Buffer.from('bar')

function addFoo (value, seq, add) {
  var foo = bipf.decode(value, bipf.seekKey(value, 0, _foo))
  add(foo)
}
function addBar (value, seq, add) {
  var bar = bipf.decode(value, bipf.seekKey(value, 0, _bar))
  add(bar)
}

function addFooBar (value, seq, add) {
  addFoo(value, seq, add); addBar(value, seq, add)
}

var addFn = addFoo

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, function (v,s,a) { addFn(v, s, a) }))

tape('setup', function (t) {

  ;(function next (n) {
    if(n == N) return done()
    db.append(encode({
      foo: 'F'+n.toString(36),
      bar: 'B'+n.toString(36)
    }), function () {
      if(n % 1000) next(n+1)
      else setImmediate(function () { next(n+1) })
    })
  })(0)


  function done () {
    console.log("DONE", Date.now() - start)
    start = Date.now()

    var rm = db.vec.since(function (v) {
      if(v !== db.since.value) return
      rm()
      t.end()
    })
  }
})

function testQuery(name, n) {
  tape('query ' + name +'('+n+'):', function (t) {
    var zero = true
    var key = name[0].toUpperCase()+n.toString(36)
    db.vec.intersects({
      keys: [key], values: true
    })
    .pipe({
      write: function (data) {
        zero = false
        console.log(bipf.decode(data, 0), hash(bipf.decode(data)[name]))
        t.equal(hash(bipf.decode(data)[name]), hash(key))
      },
      end: function (err) {
        if(err && err != true) throw err
        t.equal(zero, false, 'found more than zero')
        t.end()
      }
    })
  })
}

for(var i = 0; i < Q; i++)
  testQuery('foo', ~~(Math.random()*N))

tape('apply update', function (t) {
  db.vec.update(addBar, function () {
    t.end()
    addFn = addFooBar
  })
})

for(var i = 0; i < Q; i++)
  testQuery('bar', ~~(Math.random()*N))

tape('setup more', function (t) {
  ;(function next (n) {
    if(n == N*2) return done(n)
    db.append(encode({
      foo: 'F'+n.toString(36),
      bar: 'B'+n.toString(36)
    }), function () {
      if(n % 1000) next(n+1)
      else setImmediate(function () { next(n+1) })
    })
  })(N)


  function done (n) {
    console.log("DONE", Date.now() - start)
    start = Date.now()

    db.vec.since(function (v) {
      if(v !== db.since.value) return
      t.end()
    })
  }
})


for(var i = 0; i < Q; i++)
  testQuery(Math.random() > 0.5 ? 'foo' : 'bar', ~~(Math.random()*N))


//but we really want to test that 
