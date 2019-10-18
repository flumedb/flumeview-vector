var FlumeViewVector = require('..')
var hash = require('string-hash')
var bipf = require('bipf')
const IS_DEFINED = 1, STRING = 2, OBJECT = 4

function isEmpty (o) {
  for(var k in o) return false
  return true
}

function createIndexer (indexed) {
  return function addEverything (buf, seq, add) {
    if(isEmpty(indexed)) return

    ;(function recurse (p, path) {
      bipf.iterate(buf, p, function (_, _value, _key) {
        var type = bipf.getEncodedType(buf, _value)
        var __key = path+'.'+bipf.decode(buf, _key)
        var index_type = indexed[__key]
        if(!index_type) return

        if(index_type & IS_DEFINED) add(__key + '!!')

        if(type === bipf.types.string) {
          if(index_type & STRING && bipf.getEncodedLength(buf, _value) < 100) {
            add(__key + ':' + bipf.decode(buf, _value))
          }
        }
        else if(type == bipf.types.object) {
          recurse(_value, __key)
        }
      })
    })(0, '')
  }
}

module.exports = function () {
  return function (log, name) {
    var indexed = {}, optimistic_indexed = {}
    var vectors = FlumeViewVector(1, hash, createIndexer(indexed))(log, name)

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
        if(Array.isArray(q)) {
          for(var i = 1; i < q.length; i++)
            recurse(q[i])
        }
        else {
          var prefix = /^((?:\.[\w-]+)+)(!|\:[\w-]+)/.exec(q)
          //check if this term is indexed, or currently being added to index
          if(prefix && !optimistic_indexed[prefix[1]]) {
            toIndex[prefix[1]] = toIndex[prefix[1]] | (prefix[2][0] == ':' ? STRING : IS_DEFINED)
            var s = ''
            prefix[1].split(/\./).slice(1).forEach(function (e, _, a) {
              s += '.' + e
              toIndex[s] = toIndex[s] | OBJECT
            })
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

      var through = {
        paused: true,
        write: function (d) {
          this.sink.write(d)
        },
        end: function (err) {
          this.sink.end(err)
        },
        resume: function () {
          this.paused = false
          if(this.source) this.source.resume()
        },
        pipe: function (sink) {
          this.sink = sink
          if(this.source) this.resume()
        }
      }

      vectors.update(createIndexer(toIndex), function () {
        for(var k in toIndex)
          indexed[k] = indexed[k] | toIndex[k]
        vectors.query(opts).pipe(through)
        if(through.sink) through.resume()
      })
      return through
    }
    return {
      methods: {
        query: 'sync'
      },
      createSink: vectors.createSink,
      since: vectors.since,
      query: query
    }
  }
}
