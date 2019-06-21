var Obv         = require('obv')
var pull        = require('pull-stream')
var AtomicFile  = require('atomic-file/buffer')
var HashTable   = require('./hashtable')
var path        = require('path')
var mkdirp      = require('mkdirp')
var AsyncSingle = require('async-single')
var Vectors     = require('./vector')
var PRAF        = require('polyraf')
/*
the view takes a map and an array
map[key] = [...]

the array points to flume offsets.
it may be accessed by either index or by sequence.
(for example, streaming values greater than given sequence, forward or reverse)

things in ssb this will be useful for:

clock index [author : sequence] (needed for replication)
backlink index [msg_key : reply_seq] (replies/backlinks to a message)
general equality index [value: sequence]
  (for any value that you want to query - would make powerful queries if you merged multiple)

use intersection (and) disjunction (or), etc operators to query, just
by looking at the index values, not loading the records.
*/

module.exports = function (version, hash, each) {
  return function (log, name) {
    var since = Obv()
    var af
    var dir = path.join(path.dirname(log.filename), name)
    var ht
    var vectors
    mkdirp(dir, function (_) {
      af = AtomicFile(path.join(dir, 'hashtable.ht'))
      vectors = Vectors(PRAF(path.join(dir, 'vectors.vec'), {readable: true, writable: true}))
      af.get(function (err, value) {
        ht = HashTable().initialize(value || 65536)
        since.set(ht.buffer.readUInt32LE(0) - 1) //starts replication
      })
    })

    var w = AsyncSingle(function (value, cb) {
      if(af) {
        if(!value)
          vectors.destroy(function () {
            af.destroy(cb)
          })
        else
          vectors.drain(function () {
            af.set(value,  cb)
          })
      }
      else cb()
    })

    return {
      methods: {
        get: 'async', stream: 'source'
      },
      since: since,
      //XXX TODO rewrite flume to use push-streams?
      createSink: function (cb) {
        return pull(
          pull.asyncMap(function (dataseq, cb) {
            var seq = dataseq.seq
            var data = dataseq.value
            var n = 0, async = false
            each(data, seq, function (key) {
              n++
              if(async) throw new Error('flumeview-vector: each cannot be called async')
              var _key = hash(key)
              var vec = ht.get(_key)
              if(!vec) {
                //allocating a *new buffer* is always sync, once loaded.
                vectors.alloc(32, function (err, vec) {
                  ht.set(_key, vec)
                  if(ht.get(_key) != vec) throw new Error('set failed')
                  vectors.append(vec, seq+1, next)
                })
              }
              else
                vectors.append(vec, seq+1, function (err, _vec) {
                  //if a new vector was allocated, update the hashtable
                  if(_vec !== vec) ht.set(_key, _vec)
                  next()
                })

            })
            async = true
            if(!n) {
              //update sequence, even though we didn't write anything.
              ht.buffer.writeUInt32LE(seq+1, 0)
              w.write(ht.buffer)
              since.set(seq)
              cb()
            }
            function next () {
              if(--n) return
              n = -1
              if(ht.load() > 0.5) ht.rehash()
              ht.buffer.writeUInt32LE(seq+1, 0)
              w.write(ht.buffer)
              since.set(seq)
              cb()
            }
          }),
          pull.drain(null, cb)
        )
      },
      get: function (opts, cb) {
        var key = hash(opts.key), index = opts.index
        var vec = ht.get(key)
        if(!vec) return cb(new Error('key not found:'+opts.key))
        vectors.get(vec, index, function (err, seq) {
          if(err || seq === 0)
            cb(err || new Error('not found:'+opts.key+'['+opts.index+']'))
          else
            log.get(seq - 1, function (err, data) {
              cb(err, data, seq - 1)
            })
        })
      },
      stream: function (opts) {
        var key = opts.key, index = opts.index || 0
        if(!values[key]) return cb(new Error('key not found:'+key))
        return function (abort, cb) {
          if(abort) return cb(abort)
          if(!values[key]) return cb(new Error('key not found:'+key))
          vector.get(values[key], index++, function (err, seq) {
            if(err) cb(err)
            else if(seq == 0) cb(true)
//            else cb(null, [], seq-1)
            else log.get(seq-1, cb)
          })
        }
      }
    }
  }
}