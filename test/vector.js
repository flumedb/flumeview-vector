var tape = require('tape')

var Vector = require('../vector')
var Polyraf = require('polyraf')
var filename = '/tmp/test-flumeview-vector_vector'
//try { require('fs').unlinkSync(filename) } catch (_) { }
var raf = Polyraf(filename, {truncate: true, readable: true, writable: true})
var v = Vector(raf, 1024)

tape('alloc, set, get', function (t) {
  v.alloc(32, function (err, _vector) {
    if(err) throw err
    vector = _vector
    t.equal(vector, require('../constants').block)
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
  //but getting from the second vector should know this vector starts at 32
  //and return the same value.

  v.set(vector, 32, 19, function (err, vector2, index) {
    if(err) throw err
    t.notEqual(vector2, vector)
    t.equal(index, 32)
    v.get(vector, 32, function (err, _19) {
      if(err) throw err
      v.get(vector2, 32, function (err, __19) {
        if(err) throw err
        t.equal(_19, __19)
        t.equal(_19, 19)
        t.end()
      })
    })
  })
})

tape('allocate into next block', function (t) {
  //the first vector is 32 spaces, setting to slot 32
  v.set(vector, 128, 23, function (err, vector2, index) {
    if(err) throw err
    console.log('v2', vector2)
    v.set(vector, 256, 23, function (err, vector3, index) {
      if(err) throw err
      console.log('v2', vector2)
      v.get(vector, 256, function (err, _23) {
        if(err) throw err
        t.deepEqual(_23, 23)
        v.get(vector2, 256, function (err, _23) {
          if(err) throw err
          t.deepEqual(_23, 23)
          v.set(vector2, 256, 29, function (err) {
            if(err) throw err
            t.notEqual(vector3, vector2)
            v.get(vector, 256, function (err, _29) {
              if(err) throw err
              t.equal(_29, 29)
              //seek backwards to vector2
              v.get(vector3, 128, function (err, _23) {
                t.equal(_23, 23)
                t.end()
              })
            })
          })
        })
      })
    })
  })
})

tape('allocate multiple blocks', function (t) {
  var vec1, vec2
  v.alloc(128, function (err, _vec1) {
    if(err) throw err
    vec1 = _vec1
  })
  v.alloc(128, function (err, _vec2) {
    if(err) throw err
    vec2 = _vec2
    t.ok(vec1)
    t.ok(vec2)
    t.notEqual(vec1, vec2)
    v.set(vec1, 129, 7, function (err, vec1_2, i2) {
      console.log('vec1_2', vec1_2)
    })
    v.set(vec2, 129, 5, function (err, vec2_2, i2) {
      console.log('vec2_2', vec2_2)
      t.end()
    })

  })
})
