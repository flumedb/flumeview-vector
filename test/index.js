var pull     = require('pull-stream')
var tape     = require('tape')
var Flume    = require('flumedb')
var crypto   = require('crypto')
var Log      = require('flumelog-aligned-offset')
var toCompat = require('flumelog-aligned-offset/compat')
var path     = require('path')
var rimraf   = require('rimraf')


var filename = '/tmp/test_flumeview-vector/log.aligned'
rimraf.sync(path.dirname(filename))

var log = toCompat(Log(filename, {block: 2*1024, codec: require('flumecodec').json}))

var FlumeViewVector = require('../')

function addEverything (value, seq, add, path) {
  path = path || ''
  for(var k in value) {
    //simple values (but not numbers, because we'd want to range query those...)
    if(value[k] == null || 'string' === typeof value[k] || 'boolean' === typeof value[k]) {
      var key = path + '.' + k + ':'+value[k]
      console.log('add:', key)
      add(key)
    }
    else if('object' === typeof value[k])
      each(value[k], seq, add, path+'.'+k)
  }
}

function hash (s) {
  //much more secure than necessary...
  var h = crypto.createHash('sha256').update(s, 'utf8').digest().readUInt32LE(0)
  console.log('hash:', s, h)
  return h
}

var db = Flume(log)
  .use('vec', FlumeViewVector(1, hash, addEverything))

var data = [{
  foo: true, bar: 'baz', quux: 'okay'
},{
  foo: false, bar: 'baz', quux: 'nope'
},{
  foo: 'maybe', bar: 'BAR', quux: 'okay'
}]

tape('initialize', function (t) {
  db.append(data, function (err, offset) {
    console.log('offset', offset)
    if(err) throw err
    db.get(offset, function (err, value) {
      if(err) throw err
      console.log(value)
      db.vec.get({key:'.bar:baz', index: 0}, function (err, value) {
        if(err) throw err
        t.deepEqual(value, data[0])
        db.vec.get({key:'.bar:baz', index: 1}, function (err, value) {
          if(err) throw err
          t.deepEqual(value, data[1])
          t.end()
        })
      })
    })
  })
})

tape('stream', function (t) {
  pull(db.stream({seqs: true}), pull.collect(function (err, ary) {
    console.log(ary)
    t.end()
  }))
})

tape('intersect', function (t) {
  var a = []
  db.vec.intersects({
    keys: ['.bar:baz', '.quux:okay'],
    values: true
  })
  .pipe({
    write: function (e) {
      a.push(e)
    },
    end: function (e) {
      t.deepEqual(a, [data[0]])
      t.end()
    }
  })
})
