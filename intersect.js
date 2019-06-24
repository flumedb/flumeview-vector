
//okay for now just handle intersections, but not union or difference.
//I think those will need nesting...
var Cursor = require('./cursor')

module.exports = function (blocks, vectors, reverse, each, done) {
  if(!done) throw new Error('done cb is missing')
  var c = vectors.length //number of uninitialized cursors
  var cursors = vectors.map(function (vector) {
    return new Cursor(vector, blocks.block_size, reverse)
  })
  var block, ended
  function next () {
    var max = 0
    //will return when hits something or needs a new block
    var matched = 0
    while(matched < cursors.length) {
      for(var i = 0; i < cursors.length; i++) {
        if(!cursors[i].block) {
          block = false
          return 0
        }

          //throw new Error('intersect while block unset:'+i)
        cursor = cursors[i]
        if(cursor.isEnded()) {
          ended = true
          return 0 //done()
        }

        if(max == 0) {
          max = cursor.next()
          matched = 1
        }
        else if(cursor.value > max) {
          max = cursor.value //skip over the other items now.
          matched = 1
        }
        else if(cursor.value < max)
          cursor.next()
        else if(cursor.value === max && !cursor.matched) {
          cursor.matched = true
          matched ++
        }

        if(!cursor.block) return 0
      }
    }
    var value = cursors[0].value
//    console.log("next", max, matched, cursors.map(function (e) { return [e.index, e.value]}))
    //after a match, iterate everything forward
    var b = false
    for(var i = 0; i < cursors.length; i++) {
      cursors[i].next()
      cursors[i].matched = false
      b = b || !cursors[i].block
    }
    block = b
    return value
  }

  function intersect () {
    var v
    while(v = next()) each(v - 1)
    if(ended) done()
    else if(!block)
      setImmediate(ready)
//    var max = 0
//    //will return when hits something or needs a new block
//    while(true) {
//      var matched = 0
//      while(matched < cursors.length) {
//        for(var i = 0; i < cursors.length; i++) {
//          if(!cursors[i].block) throw new Error('intersect while block unset:'+i)
//          cursor = cursors[i]
//          if(cursor.isEnded()) return done()
//
//          if(max == 0)
//            max = cursor.next()
//          else if(cursor.value > max) {
//            max = cursor.value //skip over the other items now.
//            matched = 1
//          }
//          else if(cursor.value < max)
//            cursor.next()
//          else if(cursor.value === max) matched ++
//
//          if(!cursor.block) return setImmediate(ready) //reload fields
//        }
//      }
//      each(cursors[0].value - 1)
//      //after a match, iterate everything forward
//      var b = false
//      for(var i = 0; i < cursors.length; i++) {
//        cursors[i].next()
//        b = b || !cursors[i].block
//      }
//      if(b) return setImmediate(ready)
//    }
  }

  function ready () {
    var c = 1
    for(var i = 0; i < cursors.length; i++) {
      var cursor = cursors[i]
      if(!cursor.block) (function (cursor) {
        c++
        blocks.get(cursor.block_index, function (err, block) {
          cursor.init(block); done()
        })
      })(cursor)
    }
    done()
    function done (_, block) {
      if(--c) return
      intersect()
    }
  }

  blocks.ready(ready)
}
