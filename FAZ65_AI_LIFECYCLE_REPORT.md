# FAZ 65 — AI Request Lifecycle & State Transitions Report

## 1. 10-Step Canonical Lifecycle
1. **RECEIVED**: Inbound request recorded with timestamp and unique trace context.
2. **VALIDATED**: Input contract validated, payload bounded, prototype pollution neutralized.
3. **CLASSIFIED**: Data classification determined (`PUBLIC`, `INTERNAL`, `RESTRICTED`, `SECRET`, `CRITICAL`).
4. **ANALYZED**: Task taxonomy and capability requirements inferred deterministically.
5. **ROUTED**: Multi-factor candidate scoring, security boundary confinement, circuit breaker verification.
6. **INFERRED**: Provider dispatch with AbortController timeout and bounded retry.
7. **NORMALIZED**: Raw output normalized into canonical proposal schema.
8. **VERIFIED**: Task-specific multi-check verification (syntax, safety, schema, advisory bounds).
9. **CORRECTED**: Bounded self-correction loop (max 3 cycles) upon verification failure.
10. **FINALIZED**: Immutable, deeply-frozen `AIExecutionContract` emitted.

## 2. Prohibited Transitions
- `RECEIVED -> EXECUTED` is strictly blocked.
- Bypassing validation, classification, or routing throws `INVALID_STATE_TRANSITION`.
