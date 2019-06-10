var HT = require('../hashtable')
var crypto = require('crypto')
var tape = require('tape')

//var Vector = require('../vector')

function hash(v) {
  return crypto.createHash('sha256').update(''+v).digest().readUInt32LE(0)
}

tape('simple', function (t) {
  var ht = HT()
  ht.initialize(256)
  t.equal(ht.load(), 0)
  var slot = ht.set(hash(1), 10)
  t.equal(ht.get(hash(1)), 10)
  ht.update(slot, 12)

  t.equal(ht.get(hash(1)), 12)
  var slot = ht.set(hash(2), 0)
  t.equal(ht.get(hash(2)), 0)
  ht.update(slot, 13)
  t.equal(ht.get(hash(2)), 13)

  t.equal(ht.load(), 2/256)

  for(var i = 0; i < 128;i++) {
    var slot = ht.set(hash(i), i * 100)
    t.equal(ht.get(hash(i)), i * 100)
  }
  t.equal(ht.load(), 128/256)

  for(var i = 0; i < 128;i++) {
    t.equal(ht.get(hash(i)), i * 100)
  }

  ht.rehash()
  t.equal(ht.load(), 128/512)

  t.equal(ht.get(hash(1)), 100)
  t.equal(ht.get(hash(2)), 200)
  t.equal(ht.get(hash(127)), 12700)
  for(var j = 0; j < 128; j++) {
    t.equal(ht.get(hash(j)), j * 100)
  }
  t.end()
})
