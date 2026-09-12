# FAZ 63 — Security-First Routing & Boundary Confinement Report

## 1. Security Hierarchy
1. `PUBLIC`: Cloud & Local providers permitted.
2. `INTERNAL`: Cloud & Local providers permitted.
3. `RESTRICTED`: **Local & Self-Hosted Providers Only**. All cloud egress strictly blocked.
4. `SECRET`: **Local & Airgapped Providers Only**. All cloud egress strictly blocked.
5. `CRITICAL`: **Local Only**. Zero external transmission.

---

## 2. Adversarial Routing Boundary Verification
- **Attempt 1**: `preferredProvider: 'openai'` with `SECRET` data -> Router rejects OpenAI and routes to `local`.
- **Attempt 2**: Unsupported capability on `RESTRICTED` data -> Router throws `CAPABILITY_UNSUPPORTED` fail-closed rather than leaking to capable cloud provider.
- **Attempt 3**: Local provider failure under `RESTRICTED` data -> Fallback strictly restricted to `['local', 'local-provider', 'ollama', 'vllm', 'test-mock']`.
