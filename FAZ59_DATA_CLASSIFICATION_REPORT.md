# FAZ 59 — DATA CLASSIFICATION & BOUNDARY DEFENSE REPORT

**Status**: **PASS / FULLY VERIFIED**

---

## 1. Classification Tiers & Boundary Rules

| Tier | Sensitivity | Permitted Providers | Rule Description |
| :--- | :---: | :--- | :--- |
| **`PUBLIC`** | Level 1 | All (Cloud, Custom, Local) | Public domain code, general questions. |
| **`INTERNAL`** | Level 2 | Enterprise Cloud, Custom, Local | Proprietary workspace code under enterprise agreement. |
| **`CONFIDENTIAL`** | Level 3 | Explicitly Whitelisted Providers | High-sensitivity customer assets; requires prior whitelisting. |
| **`RESTRICTED`** | Level 4 | Local / On-Premise Only | PII, sensitive credentials; prohibited from external cloud. |
| **`SECRET`** | Level 5 | Air-Gapped Local Only | Encryption keys, production DB credentials; never leaves host. |

---

## 2. Automated Secret Detection & Classification Inference
`inferDataClassification(content)` automatically elevates classification to `SECRET` when detecting:
- OpenAI API keys (`sk-...`)
- Anthropic API keys (`sk-ant-...`)
- Google Gemini API keys (`AIza...`)
- Private RSA/EC keys (`-----BEGIN PRIVATE KEY-----`)
- Database connection URIs with credentials (`postgres://user:pass@...`)
