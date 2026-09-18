# FAZ 63 — Cost-Aware Routing & Budget Enforcement Report

## 1. Budget Hard Gates
- **Zero Budget (`budget = 0`)**: Fails closed immediately (`BUDGET_EXCEEDED`).
- **Negative Budget (`budget = -50`)**: Rejected fail-closed immediately.
- **Tight Budget (`budget <= 0.01`)**: Increases `costSensitivity` to `HIGH`, awarding maximum cost score bonus to free local providers.

---

## 2. Cost Confidence Invariant
- **EXACT**: Known models with authoritative token rates.
- **UNKNOWN**: Third-party or unregistered models return `estimatedCostUsd: null` and `pricingKnown: false` to prevent routing on fabricated numbers.
