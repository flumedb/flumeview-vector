
var tape = require('tape')
var Vector = require('../vector')

var v = Vector()

tape('alloc, set, get', function (t) {
  v.alloc(32, function (err, vector) {
    t.equal(vector, 4)
    v.set(vector, 0, 7, function (err, _vector, _index) {
      if(err) throw err
      t.equal(_vector, vector)
      t.equal(_index, 0)
      v.get(vector, 0, function (err, seven) {
        t.equal(seven, 7)
        t.end()
      })
    })
  })
})

