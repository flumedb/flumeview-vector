var Flume    = require('flumedb')
var tape     = require('tape')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
var hash     = require('string-hash')
var Reduce   = require('flumeview-reduce')
var bipf     = require('bipf')
var pull     = require('pull-stream')
var u        = require('./util')
//var Values   = require('../../push-stream/sources/values')
//var Collect  = require('../../push-stream/sinks/collect')
//var AsyncMap = require('../../push-stream/throughs/async-map')

var intersection = require('ordered-intersect/scan')

var dir = '/tmp/test_flumeview-vector'
rimraf.sync(dir)
var N = 4150, data = []

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024,
}))

var FlumeViewVector = require('..')

var start = Date.now()
function addEverything (buf, seq, add) {
  bipf.iterate(buf, 0, function (_, _value, _key) {
    add('.'+bipf.decode(buf, _key) + ':' + bipf.decode(buf, _value))
  })
}


var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var data = u.setup(tape, db, u.randomDogFruit, N)
tape('test dump', function (t) {
  pull(
    db.stream({values: true, seqs: false}),
    pull.map(function (d) {
      return bipf.decode(d, 0)
    }),
    pull.collect(function (err, ary) {
      t.deepEqual(ary, data)
      t.equal(ary.length, data.length)
      t.ok(ary.length)
      t.end()
    })
  )
})

var limits = [5, 10, 100, 1000, -1]
for(var R = 0; R < 2; R++) {
  for(var j = 0; j < limits.length; j++) {
    function t(q) {
      u.test(tape, db.vec, data, {query: q, reverse: !!R, limit: limits[j]})
    }

    t('.boolean:true')
    t(['AND', '.boolean:true'])
    t(['OR', '.boolean:true'])
    t(['OR', '.boolean:true', '.fruit:durian'])
    t(['OR', '.fruit:cherry', '.fruit:durian'])
    t(['AND', '.boolean:true', '.fruit:durian'])
    t(['DIFF', '.fruit:durian', '.boolean:true'])
    t(['OR', '.boolean:true', '.fruit:durian'])
    t(['AND', '.boolean:true'])
    t(['AND', '.boolean:true', '.boolean:true'])
    t(['AND', ['AND', '.dog:Rufus'], ['AND', '.fruit:durian']])
    t(['AND', ['AND', '.dog:Rufus']])
    t(['AND', ['AND', '.dog:Rufus', '.fruit:durian']])
    t(['AND', ['AND', '.boolean:true'], ['AND', '.boolean:true']])
    t(['AND', ['AND', '.boolean:true'], ['AND', '.fruit:durian']])
    t(['AND', '.boolean:true', '.letter:B'])
    t(['OR', ['OR', '.boolean:true', '.fruit:durian'], '.dog:Rufus'])
    t(['OR', ['AND', '.boolean:true', '.letter:B'], '.fruit:durian'])
    t(['AND', '.boolean:true', ['OR', '.fruit:cherry', '.fruit:durian']])
    t(['OR',  ['OR', '.dog:Rufus'], '.fruit:cherry'])
    t(['OR', ['OR', '.dog:Rufus', '.dog:Sally'], ['OR', '.fruit:cherry', '.fruit:durian']])
  }
}
