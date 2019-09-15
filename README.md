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
If `key` is an integer it is taken as the value that hash would have returned.

### fvv.get({vector, index}, cb)

get a single value from the index. `vector` must be a type accepted by hash,
index is the integer position to look at.

### fvv.intersects({vectors: [], reverse, limit})

return a push-stream of the intersections between one or more indexes.
the `vectors` is an array of whatever type is accepted by `hash`.

### fvv.union({vectors: [], reverse, limit})

return a push-stream of the union of one or more indexes.
a record is included in the output if it's in either or both.
If a record is in both indexes, it in _not included in the output twice_.
the `vectors` is an array of whatever type is accepted by `hash`.

### fvv.update(each_fn, cb)

Update the indexes with a new function. calls `cb` when complete.
only a single call to `update` is allowed at a time. If you need to make multiple
updates at once, they should be merged. Updates may add indexes, but not remove them.
Immediately after the update is complete, the `each` function (passed to constructor)
should be updated to do both what `each_fn` and the original `each` does.
the effect should be that rebuilding the index at this point returns both.

## License

MIT
