function size (buffer) {
  return buffer.readUInt32LE(0)
}

function next (buffer) {
  return buffer.readUInt32LE(4)
}

function b_int(int) {
  var b = Buffer.alloc(4)
  b.writeUInt32LE(int, 0)
  return b
}

var S = 8
var initial_free = Buffer.alloc(4)
initial_free.writeUInt32LE(4)

module.exports = function (raf) {
  var free, reading_free
  function read_free(cb) {
    if(free) cb(null, free)
    else if(reading_free) return reading_free.push(cb)
    else {
      reading_free = [cb]
      raf.read(0, 4, function (err, b) {
        free = err ? 4 : b.readUInt32LE(0)
        for(var i = 0; i < reading_free.length; i++)
          reading_free[i](null, free)
        reading_free = true //this is never used again
      })
    }
  }
  function write_free(cb) {
    raf.write(0, b_int(free), cb)
  }
  var self
  var nexts = {}
  return self = {
    alloc: function alloc (size, cb) {
      read_free(function (err, _free) {
        var data = Buffer.alloc(size + S)
        data.fill(0)
        data.writeUInt32LE(size, 0)
        //update before writing, so other writes
        //won't overlap, but it doesn't get saved until after.
        free += S + size*4
        raf.write(_free, data, function (err) {
          if(err) cb(err)
          //update global free pointer...
          else write_free(function (err) {
            if(err) cb(err)
            else cb(null, _free)
          })
        })
      })
    },
    set: function set (vector, index, value, cb) {
      if(!vector) return cb(new Error('out of bounds'))

      raf.read(vector, S, function (err, header) {
//        console.log('header', vector, header)
        if(err) return cb(err)
        else if(index >= size(header)) {
          if(!next(header)) {
            //alloc a new next vector
            function next_cb (err) {
              if(err) cb(err)
              else set(vector, index, value, cb)
            }
            if(!nexts[vector]) nexts[vector] = [next_cb]
            else               nexts[vector].push(next_cb)
            //console.log(nexts)
            function callback (err, value) {
              if(err) throw err
              if(!nexts[vector]) throw new Error('nexts expected for vector:'+vector)
//              console.log('nexts', vector)
              var _cbs = nexts[vector]
              nexts[vector] = value
              while(_cbs.length) _cbs.shift()(err, value)
            }
            self.alloc(size(header)*2, function (err, vector2) {
              if(err) return callback(err)
              set(vector, -1, vector2, function (err) {
//                raf.read(vector, S, function (err, header) {
    //              console.log('header was set to vector 2', vector, -1, vector2, header)
                  if(err) callback(err)
                  else    callback(null, vector2)
  //              })
              })
            })
          }
          else
            set(next(header), index - size(header), value, cb)
        }
        else
          raf.write(vector + S + index*4, b_int(value), function (err) {
            if(err) cb(err)
            else cb(null, vector, index)
          })
      })
    },
    get: function get (vector, index, cb) {
      if(!vector) return cb(new Error('not found'))

      raf.read(vector, S, function (err, header) {
        if(err) return cb(err)
        else if(index*4 > size(header))
          get(next(header), index - size(header), cb)
        else
          raf.read(vector + S + index*4, 4, function (err, b) {
            if(err) cb(err)
            else cb(null, b.readUInt32LE(0))
          })
      })
    }
  }
}



