function randomLength(max) {
  return ~~(Math.pow(Math.random(), 2)*max) + 1
}

function randomString (max) {
  var length = randomLength(max || 7)
  return (1+~~(Math.random()*(Math.pow(10, length)))).toString(36)
}

function randomObject(keys, keyLength, valueLength) {
  var keys = ~~randomLength(10)
  var o = {}
  for(var i = 0; i < keys; i++)
    o['k'+randomString(keyLength || 7)] = randomString(valueLength||10)
  return o
}

for(var i = 0; i < 100; i++)
  console.log(randomObject())

var Flume    = require('flumedb')
var tape     = require('tape')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
var bipf     = require('bipf')
var pull     = require('pull-stream')
var RNG      = require('rng')

var dir = '/tmp/test_flumeview-vector_dynamic'
rimraf.sync(dir)
var N = 10000, data = []

var mt = new RNG.MT(1)

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024,
}))

var Dynamic = require('../examples/dynamic')

var start = Date.now()
var db = Flume(log).use('dyn', Dynamic())

var int = setInterval(function () {
  console.log(Date.now() - start, db.since.value, db.vec && db.vec.since.value, db.count && db.count.since.value)
}, 500)
int.unref()

function encode (obj) {
  var l = bipf.encodingLength(obj)
  var b = Buffer.alloc(l)
  bipf.encode(obj, b, 0)
  return b
}

tape('setup', function (t) {

  ;(function next (n) {
    if(n == N) return done()
    db.append(encode(randomObject()), function () {
      if(n % 1000) next(n+1)
      else setImmediate(function () { next(n+1) })
    })
  })(0)


  function done () {
    start = Date.now()

    db.dyn.since(function (v) {
      if(v !== db.since.value) return
      t.end()
    })
  }
})
