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

var dir = '/tmp/test_flumeview-vector'
rimraf.sync(dir)
var N = 40000, data = []

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

var dogs = require('dog-names')
var fruit = ['apple', 'banana', 'cherry', 'durian', 'elderberry']
var letters = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase()

function random () {
  var value = {
    boolean: Math.random() > 0.5,
    dog: dogs.allRandom(),
    fruit: fruit[~~(Math.random()*fruit.length)],
    letter: letters[~~(Math.random()*letters.length)],
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

function testMatch(query) {
  tape('test matches:'+JSON.stringify(query), function (t) {
    var a = []
    db.vec.intersects({
      keys: Object.keys(query).map(function (k) { return '.'+k+':'+query[k] }),
      values: true
    })
    .pipe({
      write: function (d) {
        a.push(bipf.decode(d, 0))
      },
      end: function () {
      //  console.log(data)
        var _data = data.filter(function (e) {
          for(var k in query)
            if(e[k] !== query[k]) return false
          return true
        })
        t.deepEqual(a, _data)
        t.equal(a.length, _data.length, 'has '+_data.length + ' items')

        t.end()
      }
    })
  })
}

testMatch({boolean: true})
testMatch({fruit: 'durian'})
testMatch({fruit: 'cherry', boolean: false})
//testMatch({fruit: 'apple', boolean: true})
//testMatch({letter: 'ABC'})
