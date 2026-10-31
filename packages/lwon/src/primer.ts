/**
 * A short explanation of LWON for a language model, meant to sit in a prompt next
 * to LWON data. Keep it in sync with ai/lwon-primer.md.
 */
export const PRIMER = `Data below is in LWON, a compact form of JSON. Line 1 is a header naming the fields; the rest holds only values, matched to fields by position.
- Header \`a b\`: a list of objects, one row \`[...]\` per object. \`{a b}\`: a single object. \`*\`: plain JSON follows.
- \`k[x y]\` is an object with fields x, y. \`[k]\` is an array of values. \`[k[x y]]\` is an array of objects with fields x, y.
- \`@\` means "same fields as the top level"; \`@k\` means "same fields as the enclosing k". \`[@k]\` means \`[k[@k]]\`.
- \`~\` means the key is absent; a row that ends early leaves its remaining keys absent. \`null\`, \`[]\`, \`{}\` mean what they do in JSON.
- Unquoted words are strings. A value written as JSON (\`{...}\` or, in a plain field, \`[...]\`) is taken as that JSON.`;
