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
var RNG      = require('rng')

//var Values   = require('../../push-stream/sources/values')
//var Collect  = require('../../push-stream/sinks/collect')
//var AsyncMap = require('../../push-stream/throughs/async-map')

var intersection = require('ordered-intersect/scan')

var dir = '/tmp/test_flumeview-vector'
rimraf.sync(dir)
var N = 4000, data = []

var mt = new RNG.MT(1)

var log = toCompat(Log(path.join(dir, 'log.aligned'), {
  //use bipf format, so no codec needed.
  block: 1024,
}))

var FlumeViewVector = require('../')

var _dog = Buffer.from('dog')
var _fruit = Buffer.from('fruit')
var _boolean = Buffer.from('boolean')
var _letter = Buffer.from('letter')

var start = Date.now()
function addEverything (buf, seq, add) {
  bipf.iterate(buf, 0, function (_, _value, _key) {
    add('.'+bipf.decode(buf, _key) + ':' + bipf.decode(buf, _value))
  })
}

var dogs = require('dog-names').all
var fruit = ['apple', 'banana', 'cherry', 'durian', 'elderberry']
var letters = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase()

function random () {
  var value = {
    boolean: mt.random() > 0.5,
    dog: dogs[~~(dogs.length*mt.random())],
    fruit: fruit[~~(mt.random()*fruit.length)],
    letter: letters[~~(mt.random()*letters.length)],
  }
  data.push(value)
  var b = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, b)
  return b
}

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var int = setInterval(function () {
  console.log(Date.now() - start, db.since.value, db.vec && db.vec.since.value, db.count && db.count.since.value)
}, 500)
int.unref()

tape('setup', function (t) {

  ;(function next (n) {
    if(n == N) return done()
    db.append(random(), function () {
      if(n % 1000) next(n+1)
      else setImmediate(function () { next(n+1) })
    })
  })(0)


  function done () {
    start = Date.now()

    db.vec.since(function (v) {
      if(v !== db.since.value) return
      t.end()
    })
  }
})

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

function Filter(query) {
  return function (e) {
    for(var k in query)
      if(e[k] !== query[k]) return false
    return true
  }
}

function testMatch(opts) {
  var query = opts.query, limit = opts.limit, reverse = opts.reverse
  limit = limit || -1
  var string = JSON.stringify({query: query, limit: limit == -1 ? undefined : limit, reverse:reverse || undefined})

  function assertQueryAnd(t, a, data, query) {
    assertQuery(t, a, data, query, function (e) {
      for(var k in query) if(e[k] !== query[k]) return false
      return true
    })
  }

  function assertQueryOr(t, a, data, query, reverse) {
    assertQuery(t, a, data, query, function (e) {
      for(var k in query) if(e[k] === query[k]) return true
      return false
    })
  }

  function assertQueryAndNot(t, a, data, query) {
    assertQuery(t, a, data, query, function (e) {
      var first = 0
      for(var k in query) {
        if(first++) {
          if(e[k] === query[k]) return false
        }
        else if(e[k] !== query[k]) return false
      }
      return true
    })
  }

  function assertQuery(t, a, data, query, fn) {
    var n = limit
    var _data = data.filter(function (value) {
        var v = fn(value)
        if(v && n-- > 0) console.log(value, n)
        return v
    })
    if(reverse) _data = _data.reverse()
    _data = _data.slice(0, limit === -1 ? _data.length : limit)
    if(limit > -1) {
      console.log('length, limit', a.length, limit)
      t.ok(a.length <= limit, 'length less or equal to limit')
    }
    else
      t.equal(a.length, _data.length, 'has '+a.length + ' items, expected:'+_data.length)
    t.deepEqual(a, _data, 'output is equal')
  }

  tape('test matches:'+string, function (t) {
    var a = []
    var start = Date.now()
    db.vec.intersects({
      vectors: Object.keys(query).map(function (k) { return '.'+k+':'+query[k] }),
      values: true,
      limit: limit, reverse: reverse
    })
    .pipe({
      write: function (d) {
        a.push(bipf.decode(d, 0))
      },
      end: function () {
        var time = Date.now() - start
        console.log(time, a.length, a.length/time)
        assertQueryAnd(t, a, data, query)
        t.end()
      }
    })
  })

  var keys = Object.keys(query).map(function (k) { return '.'+k+':'+query[k] })
  var length = keys.length

  if(length >= 2) {
    tape('test union:'+string, function (t) {
      var a = []
      db.vec.union({
        vectors: keys, values: true, limit: limit, reverse: reverse
      })
      .pipe({
        write: function (d) {
          a.push(bipf.decode(d, 0))
        },
        end: function () {
          var time = Date.now() - start
          console.log('query time:', time, a.length, a.length/time)
          assertQueryOr(t, a, data, query)
          t.end()
        }
      })
    })
  }

  if(length === 2)
    tape('test difference:'+string, function (t) {
      var a = []
      db.vec.difference({
        keys: true,
        vectors: keys, values: true, limit: limit, reverse: reverse
      })
      .pipe({
        write: function (d) {
          a.push(bipf.decode(d.value, 0))
        },
        end: function () {
          var time = Date.now() - start
          console.log('query time:', time, a.length, a.length/time)
          assertQueryAndNot(t, a, data, query)
          t.end()
        }
      })
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
