# Comprehension eval

44 questions about six datasets, asked once per format. Each answer is compared with
a value computed from the data. JSON is minified; LWON is sent with its primer; TOON gets a one-line label.

## Accuracy

| Model | JSON | TOON | LWON |
|---|--:|--:|--:|
| claude-haiku-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) |
| claude-haiku-5-5 (effort low) | 100% (44/44) | 100% (44/44) | 98% (43/44) |
| claude-opus-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) |
| claude-sonnet-5-5 | 100% (44/44) | 100% (44/44) | 100% (44/44) |

## Accuracy by question kind

**claude-haiku-5-5**

| Kind | JSON | TOON | LWON |
|---|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 |

**claude-haiku-5-5 (effort low)**

| Kind | JSON | TOON | LWON |
|---|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 11/12 |
| aggregate | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 |

**claude-opus-5-5**

| Kind | JSON | TOON | LWON |
|---|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 |

**claude-sonnet-5-5**

| Kind | JSON | TOON | LWON |
|---|--:|--:|--:|
| lookup | 11/11 | 11/11 | 11/11 |
| count | 12/12 | 12/12 | 12/12 |
| aggregate | 4/4 | 4/4 | 4/4 |
| nested | 9/9 | 9/9 | 9/9 |
| absent | 4/4 | 4/4 | 4/4 |
| tree | 4/4 | 4/4 | 4/4 |

## Tokens (claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5)

Data only, then LWON with its primer as sent in the eval. Changes are against minified JSON.

| Dataset | JSON | TOON | LWON | LWON vs JSON | LWON + primer | vs JSON |
|---|--:|--:|--:|--:|--:|--:|
| users | 4295 | 2510 | 2503 | -42% | 2811 | -35% |
| orders | 8259 | 7435 | 4808 | -42% | 5116 | -38% |
| issues | 4378 | 4414 | 2760 | -37% | 3068 | -30% |
| menu | 562 | 578 | 362 | -36% | 670 | +16% |
| logs | 4393 | 4472 | 3222 | -27% | 3530 | -20% |
| search | 2930 | 2200 | 2298 | -22% | 2606 | -12% |

## Cost of this run

| Model | json | toon | lwon |
|---|--:|--:|--:|
| claude-haiku-5-5 | $0.010 | $0.008 | $0.009 |
| claude-haiku-5-5 (effort low) | $0.010 | $0.008 | $0.008 |
| claude-opus-5-5 | $0.331 | $0.214 | $0.232 |
| claude-sonnet-5-5 | $0.166 | $0.120 | $0.118 |
