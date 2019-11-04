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

var FlumeViewVector = require('../dynamic')

var _value = Buffer.from('value')
var _content = Buffer.from('content')

var start = Date.now()

var db = Flume(log)
  .use('vec', FlumeViewVector())

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
  console.log('items, seconds, item/second')
  setImmediate(function () {
    var C = 0, L = 0, _seq
    var start = Date.now(), ts = Date.now()

      var int = db.vec.query({ query: '.value.content.channel:solarpunk' })
      .pipe({
        write: function (e) { C++ },
        end :function () {
          var time = (Date.now() - start) / 1000
          console.log('channel:solarpunk\n' + [C, time, C / time].join(', '))
          C = 0
          var int = db.vec.query({ query: '.value.content.type:post' })
          .pipe({
            write: function (e) { C++ },
            end :function () {
              var time = (Date.now() - start) / 1000
              console.log('type:post\n' + [C, time, C / time].join(', '))
              C = 0
              var int = db.vec.query({ query: ['AND',
                '.value.content.type:post', '.value.content.channel:solarpunk'
              ], values: true, reverse: true, limit: 10})
              .pipe({
                write: function (e) { C++; /*console.log(bipf.decode(e, 0))*/ },
                end :function () {
                  console.log("END")
                  var time = (Date.now() - start) / 1000
                  console.log('type:post,channel:solarpunk, values\n' + [C, time, C / time].join(', '))
                  console.log(C, Date.now() - start)
                  setTimeout(function () {}, 1000)
                }
              })
            }
          })
        }
      })
  })
})

process.on('exit', function () {
  console.log(process.memoryUsage())
})
