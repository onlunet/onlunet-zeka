# FAZ 63 — Routing Observability & Telemetry Report

## 1. In-Memory Telemetry Ledger
The Routing Telemetry module (`src/providers/routing-telemetry.js`) maintains a thread-safe, bounded ledger of routing decisions:
- Tracks: `requestId`, `taskType`, `selectedProvider`, `selectedModel`, `routingScore`, `reasons`, `rejectedProviders`, `tenantId`, `workspaceId`, `timestamp`.
- **Zero Secret Invariant**: All Bearer tokens, passwords, and prompt injection signatures are stripped before recording.

---

## 2. Aggregated Metrics
Provides real-time stats on total routing events, provider selection distribution, model utilization, failure rates, and fallback activations.
