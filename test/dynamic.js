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

function randomLength(max) {
  return ~~(Math.pow(Math.random(), 4)*max) + 1
}

function randomString (max) {
  var length = randomLength(max || 7)
  return (1+~~(Math.random()*(Math.pow(36, length)))).toString(36)
}

function randomObject(keys, keyLength, valueLength, nestedProb) {
  keys = keys || ~~randomLength(10)
  var o = {}
  for(var i = 0; i < keys; i++) {
    var k = 'k'+randomString(keyLength || 7)
    if(isNaN(nestedProb) || Math.random() > nestedProb)
      o[k] = randomString(valueLength||3)
    else {
      o[k] = randomObject(keys/2, keyLength, valueLength, nestedProb/2)
    }
  }
  return o
}

function randomPath (o) {
  var keys = Object.keys(o)
  var k = keys[~~(Math.random()*keys.length)]
  return !isObject(o[k]) ? [k] : [k].concat(randomPath(o[k]))
}

var dir = '/tmp/test_flumeview-vector_dynamic'
rimraf.sync(dir)
var N = 1000, data = []

var mt = new RNG.MT(1)

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

function encode (obj) {
  var l = bipf.encodingLength(obj)
  var b = Buffer.alloc(l)
  bipf.encode(obj, b, 0)
  return b
}

tape('setup', function (t) {

  ;(function next (n) {
    if(n == N) return done()
    var o = randomObject(7, 5, 5, 0.5)
    a.push(o)
    db.append(encode(o), function () {
      if(n % 1000) next(n+1)
      else setImmediate(function () { next(n+1) })
    })
  })(0)


  function done () {
    db.dyn.since(function (v) {
      if(v !== db.since.value) return
      clearInterval(int)
      t.end()
    })
  }
})

for(var i = 0; i < 10; i++) {
  tape('random query', function (t) {
    var k, o
  //  do {
      var o = a[~~(Math.random()*a.length)]
      k = randomPath(o)
//    } while('string' !== typeof k);

    function Query(cb) {
      var start = Date.now(), n = 0
      console.log('query:', k, o[k])
      var out = []
      db.dyn
        .query({query: '.' + k.join('.') + ':' + nested.get(o, k), values: true})
        .pipe({
          write: function (b) {
            n++
            out.push(bipf.decode(b, 0))
          },
          end: function () {
            console.log('Query:', i++, Date.now() - start, n)
            t.ok(out.length >= 1)
            //XXX: since the view uses a hash table, sometimes there are collisions.
            //need to also scan the output to see that it matches the query.
            out.forEach(function (e) {
              if(e[k] != o[k]) throw new Error('output did not match query:'+k+' '+e[k]+'!='+o[k])
            })
            cb()
          }
        })
    }
    Query(function () { Query(t.end) })
  })
}
