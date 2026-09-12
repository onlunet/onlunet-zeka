# FAZ 63 — Model Validation Report

## 1. Overview
FAZ 63 validates models within the Model Registry against canonical provider capabilities, token boundaries, and pricing metadata.

## 2. Model Catalog Conformance

| Model ID | Provider | Context Window | Max Output | Capabilities | Verified Status |
|---|---|---|---|---|---|
| **local-deterministic-v1** | local | 32,768 | 4,096 | TEXT, STRUCTURED_OUTPUT, REASONING | **VERIFIED (LIVE)** |
| **gpt-4o** | openai | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING, JSON_MODE | **VERIFIED (SCHEMA)** |
| **gpt-4o-mini** | openai | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING, JSON_MODE | **VERIFIED (SCHEMA)** |
| **o1** | openai | 200,000 | 100,000 | TEXT, REASONING, STRUCTURED_OUTPUT, STREAMING | **VERIFIED (SCHEMA)** |
| **claude-3-5-sonnet-20241022** | anthropic | 200,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING | **VERIFIED (SCHEMA)** |
| **claude-3-5-haiku-20241022** | anthropic | 200,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING | **VERIFIED (SCHEMA)** |
| **gemini-1.5-pro** | google | 2,000,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, AUDIO, TOOL_USE, LONG_CONTEXT | **VERIFIED (SCHEMA)** |
| **gemini-1.5-flash** | google | 1,000,000 | 8,192 | TEXT, STRUCTURED_OUTPUT, VISION, AUDIO, TOOL_USE, LONG_CONTEXT | **VERIFIED (SCHEMA)** |
| **grok-2-1212** | xai | 131,072 | 4,096 | TEXT, STRUCTURED_OUTPUT, VISION, TOOL_USE, STREAMING | **VERIFIED (SCHEMA)** |
| **mistral-large-latest** | mistral | 128,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING, JSON_MODE | **VERIFIED (SCHEMA)** |
| **deepseek-chat** | deepseek | 64,000 | 4,096 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, STREAMING, JSON_MODE | **VERIFIED (SCHEMA)** |
| **deepseek-reasoner** | deepseek | 64,000 | 8,192 | TEXT, REASONING, STRUCTURED_OUTPUT, STREAMING | **VERIFIED (SCHEMA)** |
| **llama-3.3-70b-versatile** | groq | 128,000 | 32,768 | TEXT, STRUCTURED_OUTPUT, TOOL_USE, FAST_INFERENCE | **VERIFIED (SCHEMA)** |

---

## 3. Zero Fake Model Guarantee
Nonexistent models (e.g. `gpt-99-quantum`) return `null` and are rejected fail-closed without fabricating phantom configurations.
