
//okay for now just handle intersections, but not union or difference.
//I think those will need nesting...
var Cursor = require('./cursor')

module.exports = function (blocks, vectors, reverse, each, done) {
  console.log(arguments)
  if(!done) throw new Error('done cb is missing')
  var c = vectors.length //number of uninitialized cursors
  var cursors = vectors.map(function (vector) {
    return new Cursor(vector, blocks.block_size, reverse)
  })

  function intersect () {
    var max = 0
//    for(var i = 0; i < cursors.length; i++) {
//      var cursor = cursors[i]
//      if(cursor.isEnded()) return console.log('ended')
//      max = Math.max(cursor.next(), max)
////      if(!max) {
////        max = cursor.next()
////      } else {
////        var v = cursor.next()
////        if(v === max)
////          matches ++
////      }
//    }
//
    //will return when hits something or needs a new block
    while(true) {
      var matched = 0
      while(matched < cursors.length) {
        for(var i = 0; i < cursors.length; i++) {
          if(!cursors[i].block) throw new Error('intersect while block unset:'+i)
          cursor = cursors[i]
          if(cursor.isEnded()) return done()
          //console.log('cursor', i, cursor.value, max)
          if(max == 0)
            max = cursor.next()
          else if(cursor.value > max) {
            max = cursor.value //skip over the other items now.
            matched = 1
          }
          else if(cursor.value < max)
            cursor.next()
          else if(cursor.value === max) matched ++

          if(!cursor.block) return setImmediate(ready) //reload fields
        }
      }
  //    console.log("MATCHED", cursors[0].value)
      each(cursors[0].value)
      //after a match, iterate everything forward
      var b = false
      for(var i = 0; i < cursors.length; i++) {
        cursors[i].next()
        b = b || !cursors[i].block
      }
//      console.log("new block?", b, cursors)
      if(b) return setImmediate(ready)
    }
  }

  function ready () {
//    console.log("READY?")
    var c = 1
    for(var i = 0; i < cursors.length; i++) {
      var cursor = cursors[i]
      if(!cursor.block) (function (cursor) {
        c++
  //      console.log("READY", i, cursor.block_index)
        blocks.get(cursor.block_index, function (err, block) {
          cursor.init(block)
          if(--c == 1) intersect()
        })
      })(cursor)
    }
    if(c == 0) throw new Error('called ready() without any cursor needing loading')
  }

  blocks.ready(ready)
}
