# Comprehension eval

44 questions about six datasets, asked once per format. Each answer is compared with
a value computed from the data. JSON is minified; LWON is sent with its primer; TOON gets a one-line label.

## Accuracy

| Model | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| claude-haiku-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) | 100% (44/44) |
| claude-haiku-5-5 (effort low) | 100% (44/44) | 100% (44/44) | 100% (44/44) | 98% (43/44) |
| claude-opus-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) | 100% (44/44) |
| claude-sonnet-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) | 100% (44/44) |

## Accuracy by question kind

**claude-haiku-5-5**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 | 4/4 |

**claude-haiku-5-5 (effort low)**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 | 11/12 |
| aggregate | 4/4 | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 | 4/4 |

**claude-opus-5-5**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 | 4/4 |

**claude-sonnet-5-5**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 | 4/4 |

## Output tokens and cost per question

Average output tokens (including thinking), and the full cost of one question compared with JSON:
"once" prices the data as normal input, "cached" as a cache read when the same data answers many questions.

| Model | Output JSON | Output TOON | Output LWON | Output LWON-POSITIONAL | TOON once | TOON cached | LWON once | LWON cached | LWON-POSITIONAL once | LWON-POSITIONAL cached |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| claude-haiku-5-5 | 167 | 169 | 186 | 235 | -10% | -3% | -21% | -2% | -18% | +17% |
| claude-haiku-5-5 (effort low) | 146 | 158 | 154 | 210 | -9% | 0% | -23% | -7% | -19% | +16% |
| claude-opus-5-5 | 120 | 81 | 108 | 130 | -15% | -27% | -25% | -15% | -24% | -1% |
| claude-sonnet-5-5 | 86 | 76 | 83 | 108 | -12% | -12% | -25% | -15% | -24% | -2% |

## Wrong answers

| Model | Format | Question | Expected | Got |
|---|---|---|---|---|
| claude-haiku-5-5 (effort low) | lwon-positional | logs-2 | 23 | "22" |

## Tokens (claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5)

Data only, then LWON with its primer as sent in the eval. Changes are against minified JSON.

| Dataset | JSON | TOON | LWON | LWON vs JSON | LWON + primer | vs JSON |
|---|--:|--:|--:|--:|--:|--:|
| users | 4295 | 2510 | 2503 | -42% | 2831 | -34% |
| orders | 8259 | 7435 | 4808 | -42% | 5136 | -38% |
| issues | 4378 | 4414 | 2760 | -37% | 3088 | -30% |
| menu | 562 | 578 | 362 | -36% | 690 | +19% |
| logs | 4393 | 4472 | 3452 | -21% | 3780 | -14% |
| search | 2930 | 2200 | 2298 | -22% | 2626 | -11% |

## Cost of this run

| Model | json | toon | lwon | lwon-positional |
|---|--:|--:|--:|--:|
| claude-haiku-5-5 | $0.010 | $0.008 | $0.009 | $0.009 |
| claude-haiku-5-5 (effort low) | $0.010 | $0.008 | $0.008 | $0.008 |
| claude-opus-5-5 | $0.331 | $0.214 | $0.215 | $0.232 |
| claude-sonnet-5-5 | $0.166 | $0.120 | $0.128 | $0.118 |
