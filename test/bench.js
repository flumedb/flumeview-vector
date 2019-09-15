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

var _value = Buffer.from('value')
var _content = Buffer.from('content')

var start = Date.now()
function addEverything (buf, seq, add) {
  var p
  p = bipf.seekKey(buf, 0, _value)
  if(~p) {
    p = bipf.seekKey(buf, p, _content)
    if(~p)
      bipf.iterate(buf, p, function (_, _value, _key) {
        if(bipf.getEncodedType(buf, _value) == bipf.types.string && bipf.getEncodedLength(buf, _value) < 100) {
          var __key = '.'+bipf.decode(buf, _key) + ':' + bipf.decode(buf, _value)
          add(__key)
        }
      })
  }
}

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var int = setInterval(function () {
  console.log(Date.now() - start, db.since.value, db.vec && db.vec.since.value, db.count && db.count.since.value)
}, 500)
int.unref()

function done () {
  start = Date.now()
}


db.vec.since(function (v) {
  if(v !== db.since.value) return
  clearInterval(int)
  setImmediate(function () {
    var C = 0, L = 0, _seq
    var start = Date.now(), ts = Date.now()

      var int = db.vec.intersects({ vectors: ['.channel:solarpunk'] })
      .pipe({
        write: function (e) { C++ },
        end :function () {
          console.log('channel:solarpunk', C, Date.now() - start)
          C = 0
          var int = db.vec.intersects({ vectors: ['.type:post'] })
          .pipe({
            write: function (e) { C++ },
            end :function () {
              console.log('type:post', C, Date.now() - start)
              console.log(C, Date.now() - start)
              C = 0
              var int = db.vec.intersects({ vectors: [
                '.type:post', '.channel:solarpunk'
              ], values: true})
              .pipe({
                write: function (e) { C++ },
                end :function () {
                  console.log('type:post,channel:solarpunk', C, Date.now() - start)
                  console.log(C, Date.now() - start)
                }
              })
            }
          })
        }
      })
  })
})
