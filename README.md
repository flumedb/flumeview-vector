# flumeview-vector

A very light weight and flexible index that allows rich queries.

Internally, the index is like an array inside a hash table:
`{<key>:[offset,...],...}`

Think of each array as a subset (a filtering) of the flumelog.
It's in the same order as the main log, but only contains records
that have some specific property (represented by the `key`).
Since each array is in the same order, it's very fast to do
intersections on them, which allows logic operations like AND/OR
on multiple properties at once without needing to create compound indexes.
This means a small amount of indexes can support a large amount of queries.
Also, indexes are sufficiently small that they can just be generated when needed.

Flumeview-Vector **must** be used with a flumeview-log that uses `bipf` format.

## api

`FlumeViewVector = require('flumeview-vector/dynamic')`

## FlumeViewVector() => fvv

### fvv.query({query, reverse, limit})

`query` is a possibly nested tree of expressions `[OP, subexpression...|args...]`
`OP`  be `'AND'` `'OR'` `'DIFF'` or `'EQ'`
* `'EQ'` expressions are of the form `['EQ', [path...], value]`
  (`path` is an array of strings, `value` is a primitive js value)
  `EQ` queries matches any record that has the requested `value` at the requested `path`.
* `'AND'` expressions take 2 or more sub expressions.
  the output will be records matched by all sub expressions.
* `'OR'` expressions take 2 or more sub expressions.
  the output of an OR query will be records matched by any sub expression.
  records appearing in more than one subexpression will occur only once in the output.
* `'DIFF'` takes only two sub expressions.
  The output will be records in the first but not in the second.

the order of subexpressions in AND and OR expressions do not matter, but the order does
matter for DIFF.


## License

MIT
