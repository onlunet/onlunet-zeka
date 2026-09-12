# FAZ 59 — INTELLIGENT PROVIDER ROUTING & CAPABILITY MATRIX REPORT

**Status**: **PASS / FULLY VERIFIED**

---

## 1. Model Capability Matrix

| Provider | Supported Capabilities | Deployment Tier |
| :--- | :--- | :--- |
| **`openai`** | reasoning, coding, structured_output, json_mode, long_context, tool_use, streaming | Cloud (External) |
| **`anthropic`** | reasoning, coding, long_context, tool_use, vision, streaming | Cloud (External) |
| **`google`** | reasoning, coding, vision, long_context, structured_output, json_mode, streaming | Cloud (External) |
| **`custom`** | coding, structured_output, json_mode, streaming | Custom HTTP (OpenAI-compatible) |
| **`local`** | reasoning, coding, structured_output, json_mode, local | In-Process Deterministic |

---

## 2. Multi-Factor Routing Logic

1. **Candidate Pool Discovery**: Scans registered providers matching tenant and workspace visibility.
2. **Data Boundary Filtering**: Excludes cloud providers if data classification is `RESTRICTED` or `SECRET`.
3. **Capability Filtering**: Rejects any provider missing any declared `requiredCapability`. If no provider satisfies all capabilities, fails closed with `CAPABILITY_MISMATCH`.
4. **Health & Availability Prioritization**:
   - Skips providers in `OFFLINE` or `UNCONFIGURED` state when online providers exist.
   - Skips providers with `OPEN` circuit breakers.
   - Evaluates latency requirements.
5. **Fallback Resolution**: Identifies secondary candidate for automatic fallback.
6. **Zero Authority Invariant**: Returned route contract strictly specifies `executionAuthorized: false`, `proposalOnly: true`.
