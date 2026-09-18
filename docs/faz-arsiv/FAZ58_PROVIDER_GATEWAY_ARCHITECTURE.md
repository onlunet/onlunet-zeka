# FAZ 58 PROVIDER GATEWAY ARCHITECTURE

**System**: ONLUNET ZEKA Architectural Core  
**Phase**: FAZ 58 — Real AI Provider Gateway Architecture  
**Status**: ARCHITECTURALLY COMPLETE & VERIFIED  

---

## 1. ARCHITECTURAL OVERVIEW

The **Provider Gateway** is the single authoritative dispatch boundary through which all AI model invocations must pass. It decouples the internal agent and orchestration layers from external LLM providers while enforcing strict security, isolation, timeout, retry, fallback, and budgeting invariants.

```text
ORCHESTRATOR / CALLER
        │
        ▼
PROVIDER GATEWAY (`dispatch`)
        │
        ├── 1. Prototype Pollution Defense
        ├── 2. Tenant & Workspace Boundary Validation
        ├── 3. Pre-flight Budget Limit Enforcement
        ├── 4. Provider Resolution (Registry Lookup)
        │
        ├── DISPATCH TO ADAPTER (OpenAI / Anthropic / Google / Local)
        │       ├── Timeout Abort Controller (Default: 30,000 ms)
        │       ├── Native HTTPS Fetch (Zero NPM dependencies)
        │       └── Secret Scrubbing on Request & Response
        │
        ├── RETRY & FALLBACK CASCADE
        │       ├── Transient 5xx / Network Error: Bounded Retries (maxRetries = 2)
        │       ├── HTTP 429: Exponential / Retry-After Header Backoff
        │       ├── Non-Transient 4xx: Immediate Fail-Closed Halting
        │       └── Primary Provider Failure: Automatic Fallback Provider Trigger
        │
        ├── 5. Cost & Token Calculation (Model Pricing Table)
        ├── 6. Post-flight Budget Recording
        │
        ▼
NORMALIZED PROVIDER INVOCATION RESULT
        ├── status: SUCCESS / FAILED / BUDGET_EXCEEDED / TIMEOUT
        ├── output: Untrusted Data
        ├── operations / proposedFiles / proposedTests
        ├── authorityGuarantee: proposalOnly=true, executionAuthorized=false
        └── Object.freeze()
```

---

## 2. KEY COMPONENTS

### 2.1. Central Provider Registry (`src/providers/provider-registry.js`)
- Stores immutable provider definitions and adapters.
- Builtin providers:
  - `local` / `local-provider`: In-memory deterministic mock adapter with zero cost and fast execution.
  - `openai`: Native adapter for OpenAI Chat Completions API.
  - `anthropic`: Native adapter for Anthropic Messages API.
  - `google`: Native adapter for Google Gemini `generateContent` API.
- Strict isolation: Custom providers can be bound to specific `tenantId` and `workspaceId`. Any cross-tenant or cross-workspace access attempt fails closed with `SECURITY_BLOCKED`.
- Sanitized listing: `listProviders()` returns provider capabilities, models, and metadata while strictly stripping all API keys, base URLs with tokens, and secrets.

### 2.2. Provider Outbound Adapters
All adapters utilize native Node.js `fetch` and `AbortController`:
- **OpenAI Adapter (`openai-adapter.js`)**:
  - Endpoint: `https://api.openai.com/v1/chat/completions`
  - Authorization: `Bearer sk-...`
  - Parses standard chat responses and structured JSON tool calls / code blocks.
- **Anthropic Adapter (`anthropic-adapter.js`)**:
  - Endpoint: `https://api.anthropic.com/v1/messages`
  - Authorization: `x-api-key: sk-ant-...`, `anthropic-version: 2023-06-01`
  - Parses content blocks (text / thinking / tool blocks).
- **Google Gemini Adapter (`google-adapter.js`)**:
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
  - Authorization: `x-goog-api-key: AIza...`
  - Parses candidates and parts structure.
- **Local Adapter (`local-adapter.js`)**:
  - Configurable in-memory mock supporting custom operations, simulated latency, simulated timeout, and simulated rate-limiting.

### 2.3. Timeout & Retry Mechanics
1. **Timeout Enforcement**:
   - Outbound requests are bound to an `AbortSignal` with configurable `timeoutMs` (default 30s).
   - If the remote server fails to respond within the deadline, the request is aborted immediately with `AbortError` and normalized to `status: 'TIMEOUT'`.
2. **Bounded Retries**:
   - `maxRetries = 2` (maximum 3 total attempts).
   - Only transient errors (HTTP 500, 502, 503, 504, network reset) qualify for retry.
   - Non-transient 4xx errors (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden) fail immediately without retry.
3. **HTTP 429 Rate Limit Handling**:
   - Inspects `retry-after` HTTP response header (seconds or RFC 2822 date).
   - Sleeps for the specified interval (bounded to `maxRetryAfterMs = 30000`) before retrying.
4. **Fallback Provider Cascade**:
   - If the primary provider encounters an unrecoverable failure, the gateway seamlessly delegates to the configured `fallbackProviderId` (e.g. `local-provider`).

---

## 3. IMMUTABILITY & AUTHORITY GUARANTEE

The resulting `ProviderInvocationResult` is deeply frozen with `Object.freeze`:
```javascript
authorityGuarantee: Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  deploymentAuthorized: false,
  networkAuthorized: false,
  shellAuthorized: false,
  proposalOnly: true
})
```
No provider or gateway response can ever override or bypass these boolean guarantees.
