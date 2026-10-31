# LWON 1.0 — Lightweight Object Notation

> Created by **Ahmet Zencirli**. Licensed under Apache-2.0; see `LICENSE` and `NOTICE`.

LWON is a text format for JSON data. It writes the shape of the data once, in a
**header**, and then writes only the values, by position, in a **body**. Any JSON
value can be written as LWON and read back without loss. LWON is built for one
job above all: putting structured data into an LLM prompt with fewer tokens.

```
id name role [tags]
[
[1 Alice admin [new paid]]
[2 Bob user []]
]
```

is the same data as

```json
[{"id":1,"name":"Alice","role":"admin","tags":["new","paid"]},
 {"id":2,"name":"Bob","role":"user","tags":[]}]
```

## 1. Document

A document is a **header** followed by a **body**.

The header ends at the first line break that is not inside brackets. The header
has one of three forms:

| Header | Root value | Body |
|---|---|---|
| `fields` | array of objects (a *table*) | `[` row row … `]` |
| `{fields}` | one object | one record |
| `*` | any JSON value | one value (§4.1) |

An encoder MUST use `*` when the root is neither an object nor an array whose
elements include at least one object and no arrays.

## 2. Header

A header is a space-separated list of fields. Each field has a **key** and a
**kind**.

| Syntax | Kind | Holds |
|---|---|---|
| `key` | any | any value (§4.1) |
| `key[fields]` | object | one record of the inner fields |
| `[key]` | list | an array of any values |
| `[key[fields]]` | rows | an array of records of the inner fields |

The `[` that opens inner fields MUST follow the key with no whitespace between
them: `a[b]` is one object field, `a [b]` is two fields.

### 2.1 Keys

A key is written bare when it matches `[\p{L}\p{N}_$][\p{L}\p{N}_$.\-]*`.
Every other key, including the empty key, is written as a JSON string:
`"first name"`, `"@type"`, `""`.

### 2.2 Types and recursion

Every object or rows field defines a **type**: its list of inner fields. The type
is named after its key. The root table or root object is a type named `@`.

A reference `@name` stands for the nearest enclosing type named `name`; `@` alone
stands for the root type. References make recursive data possible:

| Syntax | Meaning |
|---|---|
| `key[@name]` | object field of type `name` |
| `[key[@name]]` | rows field of type `name` |
| `[@name]` | shorthand for `[name[@name]]` |

```
title link [children[@]]
```

describes a tree whose every node has `title`, `link` and `children`.

## 3. Body

Whitespace separates values. Commas outside embedded JSON are treated as
whitespace, so `[1, 2]` and `[1 2]` read the same in LWON positions.

### 3.1 Primitives

| Text | Value |
|---|---|
| `null` `true` `false` | themselves |
| a JSON number | that number |
| `"…"` | a JSON string, with JSON escapes |
| a bare word | a string |

A **bare word** starts with a letter (`\p{L}`) or `_`, contains no whitespace,
no `[ ] { } " \ , ~` and no control characters, and is not `null`, `true` or
`false`. `Alice`, `user0@example.com` and `https://x.dev/a?b=1` are bare words;
`"42"`, `"true"` and `"New York"` need quotes.

### 3.2 Values by kind

Where a field's kind expects a record or an array, the value can still be any
primitive or an embedded JSON object, so data that does not fit the header is
never lost.

| Position | `[` starts | Also allowed |
|---|---|---|
| any | a JSON array | primitive, JSON object |
| object | a record | primitive, JSON object |
| list | an array of any values | primitive, JSON object |
| rows | an array of records | primitive, JSON object |
| table row, rows element | a record | primitive, JSON object |

*Embedded JSON* is strict JSON (RFC 8259) and is read as such, commas and all:
`{"a":1}`, `[1,"x",[2]]`.

### 3.3 Records

A record is `[` followed by one value per field, in header order, then `]`.

* `~` marks a field whose key is absent from the object.
* `null` marks a key that is present with the value `null`.
* A record MAY stop early: fields after its last value are absent.
* A record MUST NOT have more values than fields.

`~` is valid only directly inside a record.

### 3.4 Empty values

| JSON | LWON |
|---|---|
| `null` | `null` |
| `[]` | `[]` |
| `{}` | `{}` |
| key absent | `~`, or nothing at the end of a record |

## 4. Rules

### 4.1 Any values

An any value is a primitive (§3.1), an embedded JSON object, or an embedded JSON
array.

### 4.2 Equality

Decoding the encoding of a JSON value MUST give back an equal value. Object key
order is not significant (RFC 8259 §4) and MAY change: keys come back in header
order.

### 4.3 Numbers

Numbers follow JSON number syntax. LWON adds no precision of its own; a decoder
reads numbers the way its platform's JSON parser does.

## 5. Grammar

```
document  = ws header ws body ws
header    = "*" / "{" fields "}" / fields          ; ends at a depth-0 line break
fields    = *( ws field ) ws
field     = key [ "[" sub "]" ]                    ; no space before "["
          / "[" key [ "[" sub "]" ] "]"
          / "[" ref "]"
sub       = fields / ref
ref       = "@" [ name ]
key       = bare-key / json-string

table-body  = "[" *( ws row ) ws "]"
row         = record / primitive / json-object
record      = "[" *( ws ( value / "~" ) ) ws "]"
value       = depends on field kind (§3.2)
```

## 6. Encoder guidance

The format allows many encodings of the same data. The reference encoder:

1. Takes the union of keys, in first-seen order, across all objects at a position.
2. Picks a kind per key: *object* when the values are objects and primitives,
   *rows* when they are arrays of objects and primitives, *list* for other
   arrays, *any* when objects and arrays are mixed.
3. Falls back to *any* when a position holds objects so sparse that `~` markers
   would cost more than repeating keys (fewer than 30% of slots filled).
4. Uses a reference instead of a new type when the objects' keys are a subset of
   an enclosing type's keys, missing at most one, and every value fits.
5. Writes a value as embedded JSON only when it does not fit the header.
6. Omits trailing `~` in records and quotes only strings that are not bare words.

## 7. Changes from the 0.x draft

* `{}` means an empty object, not null. Null is `null`; an empty array is `[]`.
* `~` marks an absent key.
* Strings use JSON escapes; bare words need no quotes.
* Values that do not fit the header are written as embedded JSON.
* `{fields}` and `*` headers cover root objects and any other root value.
* The root wrapper form `[menu[… [submenu[@menu]]]]` is removed; use
  `title link [submenu[@]]`.
