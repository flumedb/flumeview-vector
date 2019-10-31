var Flume    = require('flumedb')
var tape     = require('tape')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
var bipf     = require('bipf')
var pull     = require('pull-stream')
var nested   = require('libnested')
var u        = require('./util')

//TODO: test .a.b:c and then .a:b
//TODO: retest something with the same key but a different value.
//TODO: test false queries that shouldn't match anything

function isObject(o) {
  return 'object' === typeof o
}


var dir = '/tmp/test_flumeview-vector_dynamic'
rimraf.sync(dir)
var N = 10000, data = []

var a = []

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024*64,
}))

var Dynamic = require('../examples/dynamic')

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

var test = u.setup(tape, db, db.dyn, u.randomDogFruitNested, N)
test({
  query: '.content.fruit:apple'
})
;[-1, 1, 10, 100].forEach(function (limit) {
  for(var reverse = 0; reverse < 2; reverse ++) {
    function t(q) { test({query: q, reverse: !!reverse, limit: limit}) }

    t('.nest.dog:Mimi')
    t('.nest:Mac')
    t('.nest:Bandit')
    t('.nest.dog:Rex')
    t(['AND', '.content.letter:A', '.content.fruit:durian'])
    t(['AND', '.content.letter:B', '.content.fruit:cherry'])
    t(['OR', '.content.dog:Alex', '.content.letter:A', '.content.fruit:apple'])
    t(['DIFF', '.content.letter:B', '.content.fruit:banana'])

    //test non existing key
    test({query: '.foo.bar:BAZ', reverse: !!reverse})
    //test non existing value
    test({query: '.content.dog:VADER', reverse: !!reverse})
  }
})
