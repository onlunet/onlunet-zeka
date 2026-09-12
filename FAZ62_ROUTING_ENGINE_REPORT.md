# FAZ 62 — Multi-Factor Routing Engine Report

## 1. Routing Engine Architecture
The FAZ 62 Multi-Factor Routing Engine (`src/providers/routing-engine.js`) executes a deterministic 8-step decision pipeline to select the safest, most capable, and most cost-effective provider for any AI request.

```text
   Inbound Invocation Request
               │
               ▼
   [Step 1: Security Boundary Classification]
   - SECRET / RESTRICTED ──> Filter out all Cloud Providers (Local Only)
   - INTERNAL / PUBLIC   ──> Allow Cloud & Local Providers
               │
               ▼
   [Step 2: Capability Filtering]
   - Match required capabilities against candidate capabilities
   - Zero matches ──> Fail-closed (CAPABILITY_UNSUPPORTED)
               │
               ▼
   [Step 3: Circuit Breaker Verification]
   - Eliminate tripped providers (STATE: OPEN)
               │
               ▼
   [Step 4: Cost & Budget Optimization]
   - Eliminate providers exceeding per-request or per-task USD thresholds
               │
               ▼
   [Step 5: Preferred Provider Evaluation]
   - If preferredProvider is eligible and permitted ──> Select
               │
               ▼
   [Step 6: Priority-Based Ranking]
   - PRIMARY > SECONDARY > FALLBACK
               │
               ▼
   [Step 7: Model Resolution]
   - Model Registry lookup based on target provider
               │
               ▼
   [Step 8: Fallback Provider Designation]
   - Designate compliant fallback within identical security boundary
```

---

## 2. Decision Artifact Guarantee
Every routing decision yields an immutable frozen record:
```javascript
{
  selectedProvider: 'local',
  selectedModel: 'local-deterministic-v1',
  fallbackProvider: null,
  category: 'LOCAL',
  dataClassification: 'RESTRICTED',
  matchedCapabilities: ['TEXT', 'STRUCTURED_OUTPUT'],
  securityStatus: 'PERMITTED',
  timestamp: '2026-09-05T14:36:25.000Z'
}
```

---

## 3. Verified Fallback Invariant
When a primary provider fails during execution, the gateway transitions to the designated fallback provider. Crucially, the fallback provider **must strictly honor the initial data classification boundary**. Under no circumstance will a fallback jump from an air-gapped local provider to an external cloud provider.
