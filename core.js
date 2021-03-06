'use strict'

var path         = require('path')
var mkdirp       = require('mkdirp')
var Obv          = require('obv')
var pull         = require('pull-stream')
var AtomicFile   = require('atomic-file/buffer')
var PRAF         = require('polyraf')
var PushAsync    = require('push-stream/throughs/async')
var AsyncSingle  = require('async-single')
var Filter       = require('push-stream/throughs/filter')
var createFilter = require('bipf-filter')

var HashTable    = require('./hashtable')
var Vectors      = require('./vector')
var Blocks       = require('./blocks')

var Intersect    = require('./intersect')
var Union        = require('./union')
var Difference   = require('./difference')

var Cursor = require('./cursor')

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

var block_size = 65536
module.exports = function (version, hash, each, startEmpty) {
  return function (log, name) {
    var since = Obv()
    var af
    var dir = path.join(path.dirname(log.filename), name)
    var ht
    var vectors, blocks, updating = false
    mkdirp(dir, function (_) {
      af = AtomicFile(path.join(dir, 'hashtable.ht'))
      blocks = Blocks(PRAF(path.join(dir, 'vectors.vec'), {readable: true, writable: true}), block_size)
      vectors = Vectors.inject(blocks, block_size)
      af.get(function (_, value) {
        if(!Buffer.isBuffer(value)) {
          ht = HashTable().initialize(65536)
          if(!startEmpty)
            since.set(-1)
          else
            log.since.once(function (value) {
              since.set(value)
            })
        }
        else {
          ht = HashTable().initialize(value)
          since.set(ht.buffer.readUInt32LE(0) - 1) //starts replication
        }
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

    function createMap (each) {
      return function map (dataseq, cb) {
        var seq = dataseq.seq
        var data = dataseq.value
        var n = 0, async = false
        each(data, seq, function (key) {
          n++
          if(async) throw new Error('flumeview-vector: each cannot be called async')
          var _key = Number.isInteger(key) ? key : hash(key)
          var vec = ht.get(_key)
          if(!vec) {
            //allocating a *new buffer* is always sync, once loaded.
            vectors.alloc(32, function (err, vec) {
              ht.set(_key, vec)
              if(ht.get(_key) != vec) throw new Error('set failed: should never happen')
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
          cb(null, seq)
        }
        function next () {
          if(--n) return
          n = -1
          if(ht.load() > 0.5) ht.rehash()
          ht.buffer.writeUInt32LE(seq+1, 0)
          w.write(ht.buffer)
          cb(null, seq)
        }
      }
    }

    function Lookup (opts) {
      return new PushAsync(function (seq, cb) {
        log.get(seq, function (err, data) {
          if(err)            cb(err)
          else if(opts.keys) cb(null, {key: seq, value: data})
          else               cb(null, data)
        })
      })
    }

    return {
      methods: {
        get: 'async', //stream: 'source'
        query: 'sync',
        update: 'async'
      },
      since: since,
      //XXX TODO rewrite flume to use push-streams?
      update: function (_each, cb) {
        if(updating) throw new Error('already updating')
        updating = true
        pull(
          log.stream(),
          pull.asyncMap(createMap(_each)),
          pull.drain(null, function (err) {
            updating = false
            //note: don't update the index function until the update is complete.
            cb(err)
          })
        )
      },
      createSink: function (cb) {
        var _map = createMap(each)
        return pull(
          pull.asyncMap(function (dataseq, cb) {
            _map(dataseq, function (err, seq) {
              since.set(seq); cb()
            })
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
      query: function (opts) {
        //TODO: if the query uses an non-existing index, index it.
        var reverse = !!opts.reverse, limit = opts.limit
        var stream = (function evalQuery(args, top) {
          top = top === true
          if(args[0] == 'EQ')
            return new Cursor(blocks, ht.get(
              hash(args)),
              reverse, top ? limit : null)
          else
            return new (
              ({AND: Intersect, OR: Union, DIFF: Difference})[args[0]]
            )(blocks, args.slice(1).map(evalQuery), reverse, top ? limit : null, args)
        })(opts.query, true)

        if(!opts.values) return stream
        else {
          stream = stream.pipe(Lookup(opts))
          // because the indexes are in a hashtable,
          // sometimes there will be a collision, and two values
          // in the same index, so filter after reading.
          // disable by setting opts.filter=false
          if(!opts.filter)
            stream = stream.pipe(Filter(createFilter(opts.query)))
          return stream
        }
      }
    }
  }
}
