# FAZ 63 — Intelligent Multi-Factor Routing Report

## 1. Decision Flow
```text
User Task
   ↓
[Task Analyzer] ──> Requirements Extraction
   ↓
[Security Filter] ──> SECRET / RESTRICTED ──> Airgapped Local Providers Only
   ↓
[Capability Filter] ──> Match Required Capabilities (Fail-closed on unsupported)
   ↓
[Budget Gate] ──> Budget <= 0 or Insufficient ──> Rejection (BUDGET_EXCEEDED)
   ↓
[Circuit Breaker] ──> Tripped Providers Excluded
   ↓
[Weighted Multi-Factor Scoring] ──> Priority + Cost + Latency + Quality
   ↓
[Model Selection] ──> Resolve Capability-Matched Model
   ↓
[Designate Fallback] ──> Bound to Identical Security Tier
```

---

## 2. Composite Routing Scoring Formula
```text
totalScore = priorityScore (10-30) + costScore (10-35) + latencyScore (10-30) + qualityScore (15-30)
```
- **Hard Security Invariant**: Scoring only ranks candidates that have already passed all hard security, capability, and budget gates. A high score cannot bypass security policy.
