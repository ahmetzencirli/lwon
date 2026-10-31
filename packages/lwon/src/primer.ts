/**
 * A short explanation of LWON for a language model, meant to sit in a prompt next
 * to LWON data. Keep it in sync with ai/lwon-primer.md.
 */
export const PRIMER = `Data below is in LWON, a compact form of JSON. Line 1 is a header naming the fields; each following row \`[...]\` holds one object's values in header order.
- Read a row by position: the 1st value belongs to the 1st header field, the 2nd value to the 2nd field, and so on.
- \`~\` holds the place of a key the object does not have. A row that ends early does not have the remaining keys. \`null\` means the key is there with the value null.
- A header ending in \`*\`: a row's last value may be a JSON object holding more of that object's keys, by name. Those keys exist only in the rows that show them.
- \`k[x y]\` is an object with fields x, y. \`[k]\` is an array of values. \`[k[x y]]\` is an array of objects. \`@\` and \`@k\` reuse the fields of the top level or of the enclosing k.
- Header \`{a b}\` is a single object instead of a list; header \`*\` means plain JSON follows. Unquoted words are strings, and \`{...}\` values are JSON.`;
