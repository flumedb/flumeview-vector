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
var N = 4150, data = []

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

function createQuery (q) {
  if('string' == typeof q) {
    var parts = /^\.([^:]+)\:(.*)$/.exec(q)
    var key = parts[1], value = parts[2]
    value = value === 'true' ? true : value === 'false' ? false : !isNaN(+value) ? +value : value
    return function (data) {
      return data[key] === value
    }
  }
  var op = q[0]
  var args = q.slice(1).map(createQuery)
  if(op == 'AND')
    return function (data) {
      for(var i = 0; i < args.length; i++)
        if(!args[i](data)) return false
      return true
    }
  else if(op == 'OR')
    return function (data) {
      for(var i = 0; i < args.length; i++)
        if(args[i](data)) return true
      return false
    }
  else if(op == 'DIFF')
    return function (data) {
      return args[0](data) && !args[1](data)
    }
  else
    throw new Error('unknown operation')
}

function testMatch(opts) {
  var query = opts.query, limit = opts.limit, reverse = opts.reverse
  limit = limit || -1
  var string = JSON.stringify({query: query, limit: limit == -1 ? undefined : limit, reverse:reverse || undefined})

  function assertQuery(t, a, data, fn) {
    var n = limit
    var _data = data.filter(function (value) {
        var v = fn(value)
        //if(v && n-- > 0) console.log(value, n)
        return v
    })
    if(reverse) _data = _data.reverse()
    _data = _data.slice(0, limit === -1 ? _data.length : limit)
    if(limit > -1) {
      console.log('length, limit', a.length, limit)
      t.ok(a.length <= limit, 'length less or equal to limit')
    }
    t.equal(a.length, _data.length, 'has '+a.length + ' items, expected:'+_data.length)
    t.deepEqual(a, _data, 'output is equal')
  }

  tape('test matches:'+string, function (t) {
    var a = []
    var start = Date.now()
    db.vec.query({
      query: query,
      values: true,
      limit: limit, reverse: reverse
    })
    .pipe({
      write: function (d) {
        //console.log(bipf.decode(d, 0))
        a.push(bipf.decode(d, 0))
      },
      end: function () {
        var time = Date.now() - start
        console.log(time, a.length, a.length/time)
        assertQuery(t, a, data, createQuery(query))
        t.end()
      }
    })
  })


}


var limits = [5, 10, 100, 1000, -1]
for(var R = 0; R < 2; R++) {
  for(var j = 0; j < limits.length; j++) {
    function t(q) {
      testMatch({query: q, reverse: !!R, limit: limits[j]})
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
