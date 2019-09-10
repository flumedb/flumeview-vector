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
    console.log("DONE", Date.now() - start)
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

function testMatch(query, limit) {
  limit = limit || -1
  tape('test separate:'+JSON.stringify(query), function (t) {
    //return t.end()
    var n = Object.keys(query).length, results = {}
    var acc
    Object.keys(query).forEach(function (key) {
      var value = query[key], a = []
      db.vec.intersects({
        keys: ['.'+key+':'+value],
        //values: true
      })
      .pipe({
        write: function (d) {
          a.push(d) //bipf.decode(d, 0))
        },
        end: function () {
          var _data = data.filter(function (e) { return e[key] === value })
          //t.deepEqual(a, _data)
          t.equal(a.length, _data.length, 'has '+_data.length + ' items')
          results[key] = a
          acc = acc ? intersection.intersect(acc, a) : a
          next()
        }
      })
    })

    function next () {
      if(--n) return
      pull(
        pull.values(acc),
        pull.asyncMap(function (seq, cb) {
          db.get(seq, function (err, buf) {
            cb(err, bipf.decode(buf, 0))
          })
        }),
        pull.collect(function (err, ary) {
          _data = data.filter(Filter(query))
          t.deepEqual(ary, _data, 'MERGE IS EQUAL')
          t.end()
        })
      )
    }
  })

  function assertQueryAnd(t, a, data, query) {
    assertQuery(t, a, data, query, function (e) {
      for(var k in query) if(e[k] !== query[k]) return false
      return true
    })
  }

  function assertQueryOr(t, a, data, query) {
    assertQuery(t, a, data, query, function (e) {
      for(var k in query) if(e[k] === query[k]) return true
      return false
    })
  }


  function assertQuery(t, a, data, query, fn) {
    var _data = data.filter(fn)
    if(query.reverse) _data.reverse()
    _data = _data.slice(0, limit === -1 ? _data.length : limit)
    if(limit > -1) {
      console.log('length, limit', a.length, limit)
      t.ok(a.length <= limit, 'length less or equal to limit')
    }
    else
      t.equal(a.length, _data.length, 'has '+a.length + ' items, expected:'+_data.length)
    t.deepEqual(a, _data)
  }

  tape('test matches:'+JSON.stringify(query), function (t) {
    var a = []
    var start = Date.now()
    db.vec.intersects({
      keys: Object.keys(query).map(function (k) { return '.'+k+':'+query[k] }),
      values: true,
      limit: limit
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

  if(false)
  tape('test matches:'+JSON.stringify(query)+ ', reverse', function (t) {
    var a = []
    var start = Date.now()
//    query = Object.assign({reverse: true}, query)
    db.vec.intersects({
      keys: Object.keys(query).map(function (k) { return '.'+k+':'+query[k] }),
      values: true, reverse: true,
      limit: limit
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

  if(Object.keys(query).length == 2)
    tape('test union', function (t) {
      var a = []
      db.vec.union({
        keys: Object.keys(query).map(function (k) { return '.'+k+':'+query[k] }),
        values: true, limit: limit
      })
      .pipe({
        write: function (d) {
          a.push(bipf.decode(d, 0))
        },
        end: function () {
          var time = Date.now() - start
          console.log(time, a.length, a.length/time)
          console.log("QUERY", query)
          assertQueryOr(t, a, data, query)
          t.end()
        }
      })
    })
}

testMatch({boolean: true})
testMatch({fruit: 'durian'})
testMatch({fruit: 'cherry', boolean: false})
testMatch({fruit: 'apple', boolean: true})
testMatch({dog: 'Rufus', boolean: true})
testMatch({letter: 'ABC'})
testMatch({fruit: 'cherry', boolean: false, letter: 'A'})

testMatch({boolean: true}, 50)
testMatch({fruit: 'durian'}, 7)

testMatch({fruit: 'cherry', boolean: false}, 2)
testMatch({fruit: 'apple', boolean: true}, 9)
testMatch({dog: 'Rufus', boolean: true}, 2)
testMatch({letter: 'ABC'}, 1)
testMatch({fruit: 'cherry', boolean: false, letter: 'A'}, 3)
