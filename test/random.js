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
var nested   = require('libnested')

function isObject(o) {
  return 'object' === typeof o
}

var u = require('./util')
var dir = '/tmp/test_flumeview-vector_random'
rimraf.sync(dir)
var N = 10000, data = []

var mt = new RNG.MT(1)

var a = []

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024*64,
}))

var Dynamic = require('../dynamic')

var start = Date.now()
var db = Flume(log).use('dyn', Dynamic())

console.log('elapsed, written, processed')
var int = setInterval(function () {
  var time = (Date.now() - start)/1000
  var M = 1024*1024
  var since = db.since.value/M
  var view_since = db.dyn && db.dyn.since.value/M
  console.log(time, since, view_since, since/time, view_since/time)
}, 500)
int.unref()

function encode (obj) {
  var l = bipf.encodingLength(obj)
  var b = Buffer.alloc(l)
  bipf.encode(obj, b, 0)
  return b
}

function random () {
  return u.randomObject(7, 5, 5, 0.5)
}

var test = u.setup(tape, db, db.dyn, random, N)


//TODO: test .a.b:c and then .a:b
//TODO: retest something with the same key but a different value.
//TODO: test false queries that shouldn't match anything

for(var i = 0; i < 10; i++) {
//  tape('random query', function (t) {
    var o = u.randomItem(test.data)
    console.log(test.data, o)
    var k = u.randomPath(o)

    var str = '.' + k.join('.') + ':' + nested.get(o, k)
    test({query: str})
//    test({query: str})

  //})
}
