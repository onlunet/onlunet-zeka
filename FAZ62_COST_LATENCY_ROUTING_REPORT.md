# FAZ 62 — Cost & Latency Aware Routing Report

## 1. Cost Accounting & Pricing Table
Pricing is maintained in USD per 1 Million Tokens (Input / Output).

| Model / Provider | Input Per Million | Output Per Million | Cost Confidence |
|---|:---:|:---:|:---:|
| **local-deterministic-v1** | $0.00 | $0.00 | EXACT |
| **local-mock** | $0.00 | $0.00 | EXACT |
| **llama3 (ollama)** | $0.00 | $0.00 | EXACT |
| **mistral-7b (vllm)** | $0.00 | $0.00 | EXACT |
| **gpt-4o** | $2.50 | $10.00 | EXACT |
| **gpt-4o-mini** | $0.15 | $0.60 | EXACT |
| **o1** | $15.00 | $60.00 | EXACT |
| **o3-mini** | $1.10 | $4.40 | EXACT |
| **claude-3-5-sonnet-20241022** | $3.00 | $15.00 | EXACT |
| **claude-3-5-haiku-20241022** | $0.80 | $4.00 | EXACT |
| **claude-3-opus-20240229** | $15.00 | $75.00 | EXACT |
| **gemini-1.5-pro** | $1.25 | $5.00 | EXACT |
| **gemini-1.5-flash** | $0.075 | $0.30 | EXACT |
| **gemini-2.0-flash** | $0.10 | $0.40 | EXACT |
| **Custom / Unknown Models** | Undetermined | Undetermined | UNKNOWN (null cost) |

---

## 2. Zero Fake Cost Guarantee
In compliance with the Zero Fake Pass policy:
- Unknown or dynamically registered models do not fabricate synthetic pricing numbers.
- If pricing is unknown, `pricingKnown: false` and `estimatedCostUsd: null` are returned.
- Budgets fail-closed if estimated cost cannot be determined and strict budget enforcement is active.

---

## 3. Independent Per-Provider Circuit Breakers
- Each registered provider operates with an isolated, independent circuit breaker instance.
- A failure surge or rate-limit spike on `xai` or `mistral` trips only the offending provider's circuit breaker to `OPEN`.
- Other providers (`groq`, `deepseek`, `local`) remain completely unaffected and `HEALTHY`.
