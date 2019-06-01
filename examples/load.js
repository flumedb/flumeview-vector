
/*
  what is minimial useful database?

  key -> seq
  author -> [latest, clock_vector],
  msg -> replies_vector

and render feeds by receive time?

*/

var PRAF = require('polyraf')
var AlignedLog = require('../../flumelog-aligned-offset')
var bipf = require('../../bipf')
var Vector = require('../vector')
var PushSink = require('../../push-sink')
//var toCompat = require('../flumelog-aligned-offset')

var _value = Buffer.from('value')
var _author = Buffer.from('author')
var _sequence = Buffer.from('sequence')
var raf = PRAF('/tmp/test-flumeview-vector', {truncate: true, readable: true, writable: true})
var vectors = Vector(raf, 65536)

//function AsyncSink(fn, cb) {
//  var self, async = false
//  return self = {
//    write: function (data) {
//      async = true
//      fn(data, function (err) {
//        if(err) {
//          self.ended = err
//          this.source.abort(err)
//          if(cb) cb(err)
//          else throw err
//        }
//        async = false
//        if(self.paused) {
//          self.paused = false
//          self.source.resume()
//        }
//      })
//      if(async) self.paused = true
//    },
//    end: function () {
//      if(cb) cb()
//    }
//  }
//}

var map = {}
var C = 0
var log = AlignedLog(process.argv[2], {block: 65536})

log.stream()
.pipe(PushSink(function (data, cb) {
  var p = 0, p_author, p_sequence, author, sequence
  p = bipf.seekKey(data.value, p, _value)
  p_author = bipf.seekKey(data.value, p, _author)
  var author = bipf.decode(data.value, p_author)
  p_sequence = bipf.seekKey(data.value, p, _sequence)
  var sequence = bipf.decode(data.value, p_sequence)
//    console.log(data.seq, author)
//    console.log(author, sequence, data.seq)
  C++
  if(!(C%10000)) console.log(C)
//    return cb()
  if(!map[author]) {
    vectors.alloc(32, function (err, vector) {
      async = false
      map[author] = vector
      vectors.set(vector, sequence, data.seq, cb)
    })
  }
  else
    vectors.set(map[author], sequence, data.seq, cb)
}, function () {
  vectors.size(function (err, size) {
    console.log(size, Object.keys(map).length, C)
  })
}))


