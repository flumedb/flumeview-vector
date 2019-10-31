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

### fvv.query({query, reverse, limit})

query is either a string of the form `(.{key})+:{value}` for example `.foo.bar:baz`
will return records that have value `baz` at path `foo.bar`.
query can also be an array of `['AND' | 'OR' | 'DIFF', query...]` that returns
the intersection, union, or difference of the subqueries.

## License

MIT
