# FAZ 63 — Live Provider Certification Matrix

```text
================================================================================
                    ZERO FAKE PASS CERTIFICATION AUDIT
================================================================================
```

| Provider ID | Category | Credential | Connectivity | Inference | Normalization | Security | Certified Status |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **local** | LOCAL | Native In-Memory | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **LIVE_CERTIFIED** |
| **test-mock** | LOCAL | Native In-Memory | VERIFIED | VERIFIED | VERIFIED | VERIFIED | **LIVE_CERTIFIED** |
| **openai** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **anthropic** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **gemini** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **xai** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **mistral** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **deepseek** | DIRECT | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **openrouter**| AGGREGATOR | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **groq** | INFERENCE | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **ollama** | LOCAL | OFFLINE | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **vllm** | LOCAL | OFFLINE | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |
| **custom** | CUSTOM | NOT_CONFIGURED | DEFERRED | DEFERRED | VERIFIED | VERIFIED | **NOT_CONFIGURED (DEFERRED)** |

### Certification Rationale
Under FAZ 63 Zero Fake Pass invariants, no provider is awarded `LIVE_CERTIFIED` status without an actual live network/transport roundtrip. Cloud providers remain ready and will activate the instant valid keys are placed into environment variables.
