var RNG    = require('rng')
var bipf   = require('bipf')
var nested = require('libnested')
var mt     = new RNG.MT(1)

function isObject(o) {
  return 'object' === typeof o
}

var randomItem = exports.randomItem = function (array) {
  return array[~~(mt.random()*array.length)]
}

function randomLength(max) {
  return ~~(Math.pow(mt.random(), 4)*max) + 1
}

function randomString (max) {
  var length = randomLength(max || 7)
  return (1+~~(mt.random()*(Math.pow(36, length)))).toString(36)
}

var randomObject = exports.randomObject = function (keys, keyLength, valueLength, nestedProb) {
  keys = keys || ~~randomLength(10)
  var o = {}
  for(var i = 0; i < keys; i++) {
    var k = 'k'+randomString(keyLength || 7)
    if(isNaN(nestedProb) || mt.random() > nestedProb)
      o[k] = randomString(valueLength||3)
    else {
      o[k] = randomObject(keys/2, keyLength, valueLength, nestedProb/2)
    }
  }
  return o
}

exports.randomPath = function randomPath (o) {
  var k = randomItem(Object.keys(o))
  return !isObject(o[k]) ? [k] : [k].concat(randomPath(o[k]))
}

var dogs = require('dog-names').all
var fruit = ['apple', 'banana', 'cherry', 'durian', 'elderberry']
var letters = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase()

var randomDogFruit = exports.randomDogFruit = function () {
  return {
    boolean: mt.random() > 0.5,
    dog: randomItem(dogs),
    fruit: randomItem(fruit),
    letter: randomItem(letters),
  }
}

exports.randomDogFruitNested = function () {
  var sub = randomDogFruit()
  return {
    content: sub,
    nest: sub.boolean ? sub.dog : {dog: sub.dog}
  }
}

exports.encode = function encode (value) {
  var b = Buffer.alloc(bipf.encodingLength(value))
  bipf.encode(value, b)
  return b
}

//query interpreter, that operates on json values

var createQuery = exports.createQuery = function (q) {
//  if('string' == typeof q) {
//    var parts = /^\.([^:]+)\:(.*)$/.exec(q)
//    var path = parts[1].split('.'), value = parts[2]
//    value = value === 'true' ? true : value === 'false' ? false : !isNaN(+value) ? +value : value
//    return function (data) {
//      return nested.get(data, path) === value
//    }
//  }
  var op = q[0]

  if(op === 'EQ')
    return function (data) {
      return nested.get(data, q[1]) === q[2]
    }

  var args = q.slice(1).map(createQuery)
  if(op == 'AND')
    return function (data) {
      for(var i = 0; i < args.length; i++)
        if(!args[i](data)) return false
      return true
    }
  else if(op == 'OR')
    return function (data) {
      for(var i = 0; i < args.length; i++)
        if(args[i](data)) return true
      return false
    }
  else if(op == 'DIFF')
    return function (data) {
      return args[0](data) && !args[1](data)
    }
  else
    throw new Error('unknown operation:' + op)
}

exports.test = function (tape, vectors, data, opts) {
  var limit = opts.limit || -1
  tape('test:'+JSON.stringify(opts), function (t) {
    var a = []
    var start = Date.now()
    opts.values = true
    opts.keys = false

    vectors.query(opts)
    .pipe({
      write: function (d) {
        a.push(bipf.decode(d, 0))
      },
      end: function () {
        var time = Date.now() - start
        console.log('time, items, items/time\n' + [time, a.length, a.length/time].join(', '))

        var _data = data.filter(exports.createQuery(opts.query))
        if(opts.reverse) _data = _data.reverse()
        _data = _data.slice(0, limit === -1 ? _data.length : limit)
        if(limit > -1) {
          t.ok(a.length <= limit, 'length less or equal to limit')
        }
        else
          t.equal(a.length, _data.length, 'has ' + a.length + ' items, expected:' + _data.length)

        t.deepEqual(a, _data, 'output is equal')

        t.end()
      }
    })
  })
}


exports.setup = function (tape, db, vectors, fn, N) {
  var data = []

  for(var i = 0; i < N; i++)
    data.push((fn  || exports.randomDogFruit)())
  var start = Date.now()
  var int = setInterval(function () {
    console.log(Date.now() - start, db.since.value, db.vec && db.vec.since.value, db.count && db.count.since.value)
  }, 500)
  int.unref()


  tape('setup', function (t) {

    ;(function next (n) {
      if(n == N) return done()
      db.append(exports.encode(data[n]), function () {
        if(n % 1000) next(n+1)
        else setImmediate(function () { next(n+1) })
      })
    })(0)


    function done () {
      start = Date.now()

      vectors.since(function (v) {
        if(v !== db.since.value) return
        clearInterval(int)
        t.end()
      })
    }
  })

  function test (opts) {
    exports.test(tape, vectors, data, opts)
  }

  test.data = data

  return test
}
