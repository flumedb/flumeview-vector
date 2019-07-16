# flumeview-vector

For indexes like an array inside a hash table:
`{<key>:[offset,...],...}`

For example, to get the Nth message published by a feed.
Or the list of messages which reply to a particular message.

Also, perform _intersections_ between indexes. Since the indexes
are in the same order, calculating an intersection between them is very fast.

Also, this index is very light weight - indexes are just pointers back into the log.
With a fast format, such as [bipf](https://github.com/dominictarr/bipf),
the index can also be generated very quickly.

## api

## FlumeViewVector(version, hash, each) => fvv

create a flumeview vector instance.
`version` a number to indicate when the version changes, standard for flumeviews.
`hash` a function that takes a key and returns a 32 bit integer.
`each` a function that takes `value, sequence, add` and calls `add(key)` for
each key to be indexed. `key` can be any type that `hash` accepts.

### fvv.get({key, index}, cb)

get a single value from the index. key must be a type accepted by hash,
index is the integer position to look at.

### fvv.intersects({keys: [], reverse, limit})

return a push-stream of the intersections between one or more indexes.
the key is an array of whatever type is accepted by `hash`.

## License

MIT
