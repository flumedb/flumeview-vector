var Flume    = require('flumedb')
var tape     = require('tape')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
var hash     = require('../hash')
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

var FlumeViewVector = require('../core')

var start = Date.now()
function addEverything (buf, seq, add) {
  bipf.iterate(buf, 0, function (_, _value, _key) {
    add(['EQ', [bipf.decode(buf, _key)], bipf.decode(buf, _value)])
  })
}


var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var test = u.setup(tape, db, db.vec, u.randomDogFruit, N)
var limits = [5, 8, 9, 10, 11, 100, 1000, -1]
function EQ (path, value) {
  return ['EQ', [].concat(path), value]
}
for(var R = 0; R < 2; R++) {
  for(var j = 0; j < limits.length; j++) {
    function t(q) {
      console.log({query: q, reverse: !!R, limit: limits[j]})
      test({query: q, reverse: !!R, limit: limits[j]})
    }

    t(EQ('boolean', true))
    t(['AND', EQ('boolean', true)])
    t(['OR', EQ('boolean', true)])
    t(['OR', EQ('boolean', true), EQ('fruit', 'durian')])
    t(['OR', EQ('fruit','cherry'), EQ('fruit', 'durian')])
    t(['AND', EQ('boolean', true), EQ('fruit', 'durian')])
    t(['DIFF', EQ('fruit', 'durian'), EQ('boolean', true)])
    t(['OR', EQ('boolean', true), EQ('fruit', 'durian')])
    t(['AND', EQ('boolean', true)])
    t(['AND', ['AND', EQ('dog', 'Rufus')], ['AND', EQ('fruit', 'durian')]])
    t(['AND', ['AND', EQ('dog', 'Rufus')]])
    t(['AND', ['AND', EQ('dog', 'Rufus'), EQ('fruit', 'durian')]])
    t(['AND', ['AND', EQ('boolean', true)], ['AND', EQ('boolean', true)]])
    t(['AND', ['AND', EQ('boolean', true)], ['AND', EQ('fruit', 'durian')]])
    t(['AND', EQ('boolean', true), EQ('letter', 'B')])
    t(['OR', ['OR', EQ('boolean', true), EQ('fruit', 'durian')], EQ('dog', 'Rufus')])
    t(['OR', ['AND', EQ('boolean', true), EQ('letter', 'B')], EQ('fruit', 'durian')])
    t(['AND', EQ('boolean', true), ['OR', EQ('fruit', 'cherry'), EQ('fruit','durian')]])
    t(['OR',  ['OR', EQ('dog', 'Rufus')], EQ('fruit', 'cherry')])
    t(['OR', ['OR', EQ('dog', 'Rufus'), EQ('dog', 'Sally')], ['OR', EQ('fruit', 'cherry'), EQ('fruit', 'durian')]])

    t(['AND', EQ('boolean', true), EQ('boolean', true)])

  }
}
