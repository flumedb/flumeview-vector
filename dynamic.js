var FlumeViewVector = require('./')
var hash = require('string-hash')
var bipf = require('bipf')
var AtomicFile = require('atomic-file')
var hash = require('./hash')
var path = require('path')
var pull = require('pull-stream')
var Through = require('push-stream/throughs/through')
const IS_DEFINED = 1, STRING = 2, OBJECT = 4

function hash_array (p) {
  var v = 0
  for(var i = 0; i < p.length; i++)
    v = hash.update(v, p[i])
  return v
}

function pushCont (cont) {
  var stream
  cont(function (err, _stream) {
    if(err) _stream = new Empty(err)

    if(!stream) stream = _stream
    else _stream.pipe(stream).resume()
  })
  return stream = stream || new Through()
}

function isEmpty (o) {
  for(var k in o) return false
  return true
}

//TODO: because we use a hash table, sometimes two indexes can collide.
//to save storing the keys on the many many indexes, we can just check the output
//it can also be used for bruteforce scans of the raw log.
function createFilter(query) {
  return function (buffer, start) {}
}

function createIndexer (indexed) {
  return function (buf, seq, add) {
    if(isEmpty(indexed)) return

    ;(function recurse (p, path, hash_value) {
      bipf.iterate(buf, p, function (_, _value, _key) {
        var type = bipf.getEncodedType(buf, _value)
        var string_key = bipf.decode(buf, _key)
        var key_hash = hash.update(hash_value, string_key)
        var __key = path.concat(string_key)
        var index_type = indexed[hash_array(__key)]
        if(!index_type) return

        if(index_type & IS_DEFINED) add(hash(['EQ', __key, null]))

        if(type === bipf.types.string) {
          if(index_type & STRING && bipf.getEncodedLength(buf, _value) < 100) {
            var _hash = hash(['EQ', __key, bipf.decode(buf, _value)])
            var value = ''+bipf.decode(buf, _value)
            var _hash2 = hash.update(key_hash, value)
            if(_hash !== _hash2) {
              throw new Error('expected incremental hash to be equal:')
            }
            add(_hash)
          }
        }
        else if(type == bipf.types.object) {
          recurse(_value, __key, key_hash)
        }
      })
    })(0, [], 0)
  }
}

module.exports = function () {
  return function (log, name) {
    var indexed, optimistic_indexed = {}
    var af = AtomicFile(path.join(path.dirname(log.filename), name, 'indexed.json'))
    var vectors = FlumeViewVector(1, hash, createIndexer(indexed))(log, name)
    af.get(function (err, _indexed) {
      indexed = _indexed || {}
    })
    var updating = false

    function isEmpty (o) {
      for(var k in o) return false
      return true
    }

    function query (opts) {
      //check if any indexes need to be added, and arn't already being added.
      //when update is finished, perform query
      var q = opts.query, toIndex = {}

      ;(function recurse (q) {
        //[AND|OR|DIFF, terms...] add terms to index. AND|OR|DIFF doesn't matter
        if(!Array.isArray(q)) throw new Error('invalid query:'+JSON.stringify(q))
        if(q[0] !== 'EQ') {
          for(var i = 1; i < q.length; i++)
            recurse(q[i])
        }
        else {
          var [_EQ, path, value] = q
          var p = hash_array(path)
          if(!(STRING & (indexed[p] | optimistic_indexed[p]))) {
            toIndex[p] = toIndex[p] | STRING
            var _path = []
            for(var i = 0; i < path.length-1; i++) {
              _path.push(path[i])
              var p2 = hash_array(_path)
              toIndex[p2] = toIndex[p2] | OBJECT
            }
          }
        }
      })(q)
      if(isEmpty(toIndex)) {
        return vectors.query(opts) //we don't need to index anything
      }
      else {
        //copy new terms into optimistic_index (indexed terms, and terms being current added)
        for(var k in toIndex)
            optimistic_indexed[k] =  toIndex[k]
      }

      return pushCont(function (cb) {
        vectors.update(createIndexer(toIndex), function () {
          for(var k in toIndex) {
            indexed[k] = indexed[k] | toIndex[k]
  //          delete optimistic_indexed[k]
          }
          af.set(indexed, function () {})
          cb(null, vectors.query(opts))
        })
      })
    }
    return {
      methods: {
        query: 'sync'
      },
      createSink: function (cb) {
        return function (read) {
          af.get(function () {
            pull(read, vectors.createSink(cb))
          })
        }
      },
      since: vectors.since,
      query: function (opts) {
        if(indexed) {
          this.query = query
          return query(opts)
        }
        else {
          return pushCont(function (cb) {
            af.get(function () {
              cb(null, query(opts))
            })
          })
        }
      }
    }
  }
}
