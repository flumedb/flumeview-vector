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

var intersection = require('ordered-intersect/scan')

var dir = '/tmp/test_flumeview-vector'
rimraf.sync(dir)
var N = 4000, data

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024,
}))

var FlumeViewVector = require('../core')

var _dog = Buffer.from('dog')
var _fruit = Buffer.from('fruit')
var _boolean = Buffer.from('boolean')
var _letter = Buffer.from('letter')

var start = Date.now()
function addEverything (buf, seq, add) {
  bipf.iterate(buf, 0, function (_, _value, _key) {
    add(['EQ', bipf.decode(buf, _key), bipf.decode(buf, _value)])
  })
}

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var test = u.setup(tape, db, db.vec, u.randomDogFruit, N)
function testMatch(opts) {
  var query = opts.query, limit = opts.limit, reverse = opts.reverse
  limit = limit || -1
  var string = JSON.stringify({query: query, limit: limit == -1 ? undefined : limit, reverse:reverse || undefined})
  var keys = Object.keys(query).map(function (k) { return ['EQ', [k], query[k]] })
  var length = keys.length
  test({
    query: ['AND'].concat(keys), reverse: reverse, limit: limit
  })
  if(length >= 2)
    test({
      query: ['OR'].concat(keys), reverse: reverse, limit: limit
    })
  if(length == 2)
    test({
      query: ['DIFF'].concat(keys), reverse: reverse, limit: limit
    })

}

testMatch({query:{boolean: true}})
testMatch({query: {fruit: 'durian'}})
testMatch({query: {fruit: 'cherry', boolean: false}})
testMatch({query: {fruit: 'apple', boolean: true}})
testMatch({query: {dog: 'Rufus', boolean: true}})
testMatch({query: {letter: 'ABC'}}) //empty
testMatch({query: {fruit: 'cherry', boolean: false, letter: 'A'}})

testMatch({query: {boolean: true}, limit: 50})
testMatch({query: {fruit: 'durian'}, limit: 7})

testMatch({query: {fruit: 'cherry', boolean: false}, limit: 5})
testMatch({query: {fruit: 'apple', boolean: true}, limit: 9})
testMatch({query: {dog: 'Rufus', boolean: true}, limit: 2})
testMatch({query: {letter: 'ABC'}, limit: 1})
testMatch({query: {fruit: 'cherry', boolean: false, letter: 'A'}, limit: 3})


testMatch({query: {boolean: true}, reverse: true})
testMatch({query: {fruit: 'durian'}, reverse: true})
testMatch({query: {fruit: 'cherry', boolean: false}, reverse: true})
testMatch({query: {fruit: 'apple', boolean: true}, reverse: true})
testMatch({query: {dog: 'Rufus', boolean: true}, reverse: true})
testMatch({query: {letter: 'ABC'}, reverse: true}) //empty
testMatch({query: {fruit: 'cherry', boolean: false, letter: 'A'}, reverse: true})

testMatch({query: {boolean: true}, limit: 50, reverse: true})
testMatch({query: {fruit: 'durian'}, limit: 7, reverse: true})

testMatch({query: {fruit: 'cherry', boolean: false}, limit: 5, reverse: true})
testMatch({query: {fruit: 'apple', boolean: true}, limit: 9, reverse: true})
testMatch({query: {dog: 'Rufus', boolean: true}, limit:2, reverse: true})
testMatch({query: {letter: 'ABC'}, limit:1, reverse:true}) //reverse doesn't matter if limit=1
testMatch({query: {fruit: 'cherry', boolean: false, letter: 'A'}, limit: 3, reverse: true})
