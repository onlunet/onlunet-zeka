# FAZ 62 — Model Registry Report

## 1. Overview
FAZ 62 decouples **Provider** from **Model**. While a provider represents a transport gateway with credentials and endpoint configuration, a model represents an inference target with distinct capabilities, token limits, and pricing.

```text
Provider (e.g. 'groq') ───┬─── Model ('llama-3.3-70b-versatile')
                          ├─── Model ('mixtral-8x7b-32768')
                          └─── Model ('deepseek-r1-distill-llama-70b')
```

---

## 2. Registered Model Catalog

| Model ID | Provider ID | Context Window | Max Output | Capabilities | Pricing Known |
|---|---|---|---|---|---|
| **local-deterministic-v1** | local | 32,768 | 4,096 | TEXT, STRUCTURED_OUTPUT, REASONING | Yes ($0.00) |
| **gpt-4o** | openai | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING, JSON_MODE | Yes ($2.50 / $10.00) |
| **gpt-4o-mini** | openai | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING, JSON_MODE | Yes ($0.15 / $0.60) |
| **o1** | openai | 200,000 | 100,000 | TEXT, REASONING, STRUCTURED_OUTPUT, STREAMING | Yes ($15.00 / $60.00) |
| **o3-mini** | openai | 200,000 | 100,000 | TEXT, REASONING, STRUCTURED_OUTPUT, STREAMING | Yes ($1.10 / $4.40) |
| **claude-3-5-sonnet-20241022** | anthropic | 200,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING | Yes ($3.00 / $15.00) |
| **claude-3-5-haiku-20241022** | anthropic | 200,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING | Yes ($0.80 / $4.00) |
| **claude-3-opus-20240229** | anthropic | 200,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, REASONING | Yes ($15.00 / $75.00) |
| **gemini-1.5-pro** | gemini | 2,000,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, AUDIO, TOOL_USE, LONG_CONTEXT | Yes ($1.25 / $5.00) |
| **gemini-1.5-flash** | gemini | 1,000,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, AUDIO, TOOL_USE, LONG_CONTEXT | Yes ($0.075 / $0.30) |
| **gemini-2.0-flash** | gemini | 1,000,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, AUDIO, TOOL_USE, LONG_CONTEXT | Yes ($0.10 / $0.40) |
| **grok-2-1212** | xai | 131,072 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING | Yes |
| **grok-2-vision-1212** | xai | 32,768 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, STREAMING | Yes |
| **mistral-large-latest** | mistral | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING, JSON_MODE | Yes |
| **codestral-latest** | mistral | 32,768 | 4,096 | TEXT, STRUCTURED_OUTPUT, STREAMING | Yes |
| **deepseek-chat** | deepseek | 64,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING, JSON_MODE | Yes |
| **deepseek-reasoner** | deepseek | 64,000 | 8,192 | TEXT, REASONING, STRUCTURED_OUTPUT, STREAMING | Yes |
| **llama-3.3-70b-versatile** | groq | 128,000 | 32,768 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING, JSON_MODE | Yes |
| **llama3** | ollama | 8,192 | 2,048 | TEXT, STRUCTURED_OUTPUT, STREAMING | Local ($0.00) |
| **mistral-7b** | vllm | 32,768 | 4,096 | TEXT, STRUCTURED_OUTPUT, STREAMING | Local ($0.00) |

---

## 3. Model Lookup Capabilities
The Model Registry allows querying models by required capability (e.g. `findModelsByCapability('REASONING')` or `findModelsByCapability('VISION')`), dynamically matching the best model for a task before routing to the corresponding provider gateway.
