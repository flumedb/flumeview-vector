var Flume    = require('flumedb')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')
var hash     = require('string-hash')
var Reduce   = require('flumeview-reduce')
var bipf     = require('bipf')

//var dir = '/tmp/test_flumeview-vector'
//rimraf.sync(dir)

var log = toCompat(Log(
  '/tmp/log.bipf.aligned'
//path.join(dir, 'log.aligned'
, {
  block: 64*1024, //codec: require('flumecodec').json
}))

var FlumeViewVector = require('../')

var _dog = Buffer.from('dog')
var _fruit = Buffer.from('fruit')
var _boolean = Buffer.from('boolean')
var _letter = Buffer.from('letter')

var _value = Buffer.from('value')
var _content = Buffer.from('content')

var start = Date.now()
function addEverything (buf, seq, add, path) {
  var p
  p = bipf.seekKey(buf, 0, _value)
  if(~p)
    p = bipf.seekKey(buf, p, _content)
  if(~p)
    bipf.iterate(buf, p, function (_, _value, _key) {
//      console.log('length', bipf.getEncodedType(buf, _value) == bipf.types.string, bipf.getEncodedLength(buf, _value))
      if(bipf.getEncodedType(buf, _value) == 0 && bipf.getEncodedLength(buf, _value) < 100) {
        var __key = '.'+bipf.decode(buf, _key) + ':' + bipf.decode(buf, _value)
        add(__key)
//        console.log(__key)
      }
    })
}

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))
//  .use('count', Reduce(1, function (acc) { return acc + 1 }))

/*
var dogs = require('dog-names')
var fruit = ['apple', 'banana', 'cherry', 'durian', 'elderberry']
var letters = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase()
function random () {
  var data = {
    boolean: Math.random() > 0.5,
    dog: dogs.allRandom(),
    fruit: fruit[~~(Math.random()*fruit.length)],
    letter: letters[~~(Math.random()*letters.length)],
  }
  var b = Buffer.alloc(bipf.encodingLength(data))
  bipf.encode(data, b)
  return b
}

var N = 1000000, data = []
;(function next (n) {
  if(n == N) return done()
  var value = random()
  data.push(value)
  db.append(value, function () {
    next(n+1)
  })
})(0)
*/

var int = setInterval(function () {
  console.log(Date.now() - start, db.since.value, db.vec && db.vec.since.value, db.count && db.count.since.value)
}, 500)
int.unref()

function done () {
//  console.log("DONE", Date.now() - start)
  start = Date.now()
}

db.vec.since(function (v) {
  if(v !== db.since.value) return
    setImmediate(function () {
  //    console.log("sync")
//      var k = '.root:%0/JiKc99TG3lbJImZJir3hu89UABOlicjs6QAPug6ow=.sha256'
//      var k = '.channel:patchwork'
      var k = '.type:post'
      var C = 0, L = 0
      var start = Date.now()
      ;(function next (i) {
        db.vec.get({key:k, index: i}, function (err, data, seq) {
          if(err && i === 0) throw err
          else if(!data && i >= 0) return console.log("GOT", C, L, Date.now() - start)
//          console.log('get', err, data)
  //        if(err) throw err
          C ++
          L += data.length
//          console.log(data.length, seq)
          setImmediate(function () {
            next(i+1)
          })
        })
      })(0)
    })
})
