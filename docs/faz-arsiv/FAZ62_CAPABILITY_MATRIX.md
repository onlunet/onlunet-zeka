# FAZ 62 — Provider & Model Capability Matrix

## 1. Canonical Capability Taxonomy
FAZ 62 defines **10 canonical capabilities**:
1. `TEXT` (Core natural language generation)
2. `STRUCTURED_OUTPUT` (JSON Schema / strictly typed responses)
3. `VISION` (Image input and multimodal vision understanding)
4. `AUDIO` (Audio transcription / comprehension)
5. `EMBEDDING` (Vector representation generation)
6. `TOOL_USE` (Function / tool proposal generation)
7. `REASONING` (Deep chain-of-thought / deliberate reasoning)
8. `STREAMING` (Server-sent events / chunk-by-chunk delta transport)
9. `LONG_CONTEXT` (Context windows exceeding 500,000 tokens)
10. `JSON_MODE` (Native JSON formatting enforcement)

---

## 2. 10+ Provider Capability Matrix

| Provider ID | Category | TEXT | STRUCT | VISION | AUDIO | EMBED | TOOL | REASON | STREAM | LONG_CTX | JSON |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **local** | LOCAL | YES | YES | NO | NO | NO | NO | YES | YES | NO | YES |
| **openai** | DIRECT | YES | YES | YES | NO | NO | YES | YES | YES | NO | YES |
| **anthropic** | DIRECT | YES | YES | YES | NO | NO | YES | YES | YES | NO | YES |
| **gemini** | DIRECT | YES | YES | YES | YES | NO | YES | NO | YES | YES | YES |
| **xai** | DIRECT | YES | YES | YES | NO | NO | YES | NO | YES | NO | YES |
| **mistral** | DIRECT | YES | YES | NO | NO | NO | YES | NO | YES | NO | YES |
| **deepseek** | DIRECT | YES | YES | NO | NO | NO | YES | YES | YES | NO | YES |
| **openrouter**| AGGREGATOR | YES | YES | YES | NO | NO | YES | YES | YES | YES | YES |
| **groq** | INFERENCE | YES | YES | NO | NO | NO | YES | NO | YES | NO | YES |
| **ollama** | LOCAL | YES | YES | NO | NO | NO | NO | NO | YES | NO | YES |
| **vllm** | LOCAL | YES | YES | NO | NO | NO | NO | NO | YES | NO | YES |
| **custom** | CUSTOM | YES | YES | NO | NO | NO | NO | NO | YES | NO | YES |
| **test-mock**| LOCAL | YES | YES | NO | NO | NO | NO | NO | YES | NO | YES |

---

## 3. Capability Enforcement
The Routing Engine validates that every requested capability in `requiredCapabilities` is supported by the candidate provider adapter. If no provider satisfies all requested capabilities, the router immediately **fails closed** with `CAPABILITY_UNSUPPORTED` without falling back to an under-capable provider.
