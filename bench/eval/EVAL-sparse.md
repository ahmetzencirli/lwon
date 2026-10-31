# Comprehension eval: sparse suite

22 questions about 150 log events where most fields are optional and some are null, asked 3 times per format. Each answer is compared with
a value computed from the data. JSON is minified; LWON is sent with its primer; TOON gets a one-line label.

## Accuracy

Correct answers over all trials; in brackets, the questions answered wrong at least once.

| Model | JSON | TOON | LWON | LWON-POSITIONAL | LWON-P2 |
|---|--:|--:|--:|--:|--:|
| claude-haiku-5-5 | 92% (61/66) [3] | 98% (65/66) [1] | 95% (63/66) [3] | 94% (62/66) [4] | 95% (63/66) [2] |
| claude-haiku-5-5 (effort low) | 95% (63/66) [3] | 97% (64/66) [2] | 91% (60/66) [5] | 94% (62/66) [2] | – |
| claude-sonnet-5-5 | 98% (43/44) [1] | 98% (43/44) [1] | 95% (42/44) [2] | 100% (44/44) [0] | – |

## Accuracy by question kind

**claude-haiku-5-5**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL | LWON-P2 |
|---|--:|--:|--:|--:|--:|
| count | 25/30 | 29/30 | 27/30 | 26/30 | 27/30 |
| aggregate | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| absent | 33/33 | 33/33 | 33/33 | 33/33 | 33/33 |

**claude-haiku-5-5 (effort low)**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| count | 27/30 | 28/30 | 24/30 | 26/30 |
| aggregate | 3/3 | 3/3 | 3/3 | 3/3 |
| absent | 33/33 | 33/33 | 33/33 | 33/33 |

**claude-sonnet-5-5**

| Kind | JSON | TOON | LWON | LWON-POSITIONAL |
|---|--:|--:|--:|--:|
| count | 19/20 | 19/20 | 19/20 | 20/20 |
| aggregate | 2/2 | 2/2 | 1/2 | 2/2 |
| absent | 22/22 | 22/22 | 22/22 | 22/22 |

## Output tokens and cost per question

Average output tokens (including thinking), and the full cost of one question compared with JSON:
"once" prices the data as normal input, "cached" as a cache read when the same data answers many questions.

| Model | Output JSON | Output TOON | Output LWON | Output LWON-POSITIONAL | Output LWON-P2 | TOON once | TOON cached | LWON once | LWON cached | LWON-POSITIONAL once | LWON-POSITIONAL cached | LWON-P2 once | LWON-P2 cached |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| claude-haiku-5-5 | 629 | 644 | 721 | 2499 | 2663 | +4% | +3% | -9% | +7% | +42% | +212% | +47% | +232% |
| claude-haiku-5-5 (effort low) | 521 | 527 | 604 | 2175 | – | +4% | +2% | -10% | +6% | +35% | +214% | – | – |
| claude-sonnet-5-5 | 273 | 255 | 353 | 545 | – | +4% | -2% | -11% | +9% | -17% | +41% | – | – |

## Wrong answers

| Model | Format | Question | Expected | Got |
|---|---|---|---|---|
| claude-haiku-5-5 | lwon-positional | sparse-1 | 88 | "86" |
| claude-haiku-5-5 | lwon-p2 | sparse-1 | 88 | "89" |
| claude-haiku-5-5 | lwon-p2 | sparse-1 | 88 | "85" |
| claude-haiku-5-5 (effort low) | json | sparse-1 | 88 | "87" |
| claude-haiku-5-5 (effort low) | lwon-positional | sparse-1 | 88 | "87" |
| claude-haiku-5-5 (effort low) | lwon-positional | sparse-1 | 88 | "86" |
| claude-haiku-5-5 | lwon-positional | sparse-2 | 11 | "10" |
| claude-haiku-5-5 | json | sparse-3 | 80 | "79" |
| claude-haiku-5-5 (effort low) | lwon | sparse-3 | 80 | "83" |
| claude-haiku-5-5 (effort low) | lwon-positional | sparse-3 | 80 | "81" |
| claude-haiku-5-5 (effort low) | lwon-positional | sparse-3 | 80 | "81" |
| claude-haiku-5-5 | toon | sparse-4 | 37 | "36" |
| claude-haiku-5-5 | lwon | sparse-4 | 37 | "34" |
| claude-haiku-5-5 (effort low) | toon | sparse-4 | 37 | "36" |
| claude-haiku-5-5 (effort low) | lwon | sparse-4 | 37 | "35" |
| claude-haiku-5-5 | lwon | sparse-5 | 18 | "16" |
| claude-haiku-5-5 (effort low) | toon | sparse-5 | 18 | "16" |
| claude-haiku-5-5 (effort low) | lwon | sparse-5 | 18 | "17" |
| claude-haiku-5-5 (effort low) | lwon | sparse-5 | 18 | "17" |
| claude-haiku-5-5 (effort low) | lwon | sparse-6 | 12 | "11" |
| claude-sonnet-5-5 | lwon | sparse-6 | 12 | "13" |
| claude-haiku-5-5 | lwon-positional | sparse-7 | 23 | "22" |
| claude-sonnet-5-5 | json | sparse-7 | 23 | "22" |
| claude-haiku-5-5 | json | sparse-8 | 18 | "17" |
| claude-haiku-5-5 | json | sparse-8 | 18 | "17" |
| claude-haiku-5-5 | lwon | sparse-8 | 18 | "17" |
| claude-haiku-5-5 (effort low) | json | sparse-8 | 18 | "17" |
| claude-haiku-5-5 (effort low) | lwon | sparse-8 | 18 | "17" |
| claude-haiku-5-5 | json | sparse-9 | 25 | "24" |
| claude-haiku-5-5 | json | sparse-9 | 25 | "24" |
| claude-haiku-5-5 | lwon-positional | sparse-9 | 25 | "24" |
| claude-haiku-5-5 | lwon-p2 | sparse-9 | 25 | "24" |
| claude-haiku-5-5 (effort low) | json | sparse-9 | 25 | "24" |
| claude-sonnet-5-5 | toon | sparse-10 | 49 | "48" |
| claude-sonnet-5-5 | lwon | sparse-11 | 23237 | "24072" |

## Tokens (claude-haiku-5-5, claude-sonnet-5-5, claude-opus-5-5)

Data only, then LWON with its primer as sent in the eval. Changes are against minified JSON.

| Dataset | JSON | TOON | LWON | LWON vs JSON | LWON + primer | vs JSON |
|---|--:|--:|--:|--:|--:|--:|
| sparse | 10922 | 11433 | 8835 | -19% | 9163 | -16% |

## Cost of this run

| Model | json | toon | lwon | lwon-positional | lwon-p2 |
|---|--:|--:|--:|--:|--:|
| claude-haiku-5-5 | $0.031 | $0.030 | $0.032 | $0.089 | $0.095 |
| claude-haiku-5-5 (effort low) | $0.025 | $0.025 | $0.030 | $0.077 | – |
| claude-sonnet-5-5 | $0.271 | $0.243 | $0.324 | $0.327 | – |
