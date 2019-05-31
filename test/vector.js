var tape = require('tape')
var Vector = require('../vector')
var v = Vector(null, 1024), vector

tape('alloc, set, get', function (t) {
  v.alloc(32, function (err, _vector) {
    if(err) throw err
    vector = _vector
    t.equal(vector, 4)
    v.set(vector, 0, 7, function (err, _vector, _index) {
      if(err) throw err
      t.equal(_vector, vector)
      t.equal(_index, 0)
      v.get(vector, 0, function (err, seven) {
        if(err) throw err
        t.equal(seven, 7)
        t.end()
      })
    })
  })
})

tape('set, get 2', function (t) {
  v.get(vector, 0, function (err, value) {
    if(err) throw err
    t.equal(value, 7)
    v.set(vector, 1, 11, function (err) {
      if(err) throw err
      v.set(vector, 2, 13, function (err) {
        if(err) throw err
        v.get(vector, 1, function (err, _11) {
          if(err) throw err
          t.equal(_11, 11)
          v.get(vector, 2, function (err, _13) {
            if(err) throw err
            t.equal(_13, 13)
            t.end()
          })
        })
      })
    })
  })
})

tape('allocate via set', function (t) {
  //the first vector is 32 spaces, setting to slot 32
  //should allocate a 2nd vector 64 spaces, and set index 0
  v.set(vector, 32, 19, function (err, vector2, index) {
    if(err) throw err
    t.notEqual(vector2, vector)
    t.equal(index, 0)
    v.get(vector, 32, function (err, _19) {
      if(err) throw err
      v.get(vector2, 0, function (err, __19) {
        if(err) throw err
        t.equal(_19, _19)
        t.equal(_19, 19)
        t.end()
      })
    })
  })
})

tape('allocate into next block', function (t) {
  //the first vector is 32 spaces, setting to slot 32
  //should allocate a 2nd vector 64 spaces, and set index 0
  v.set(vector, 128, 23, function (err, vector2, index) {
    if(err) throw err
    console.log('v2', vector2)
    v.set(vector, 256, 23, function (err, vector2, index) {
      if(err) throw err
      console.log('v2', vector2)
      v.get(vector, 256, function (err, _23) {
        t.deepEqual(_23)
        t.end()
      })
    })
//    t.notEqual(vector2, vector)
//    console.log(vector2, vector)
//    t.equal(index, 0)
//    v.get(vector, 32, function (err, _19) {
//      if(err) throw err
//      v.get(vector2, 0, function (err, __19) {
//        if(err) throw err
//        t.equal(_19, _19)
//        t.equal(_19, 19)
//        t.end()
//      })
//    })
  })
})



