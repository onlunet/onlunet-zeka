# FAZ 64 — OpenAI Security & Classification Audit

## 1. Data Classification Boundary Matrix
| Classification | Cloud (OpenAI) Allowed | Local Allowed | Result |
|----------------|------------------------|---------------|--------|
| `SECRET` | NO | YES | OpenAI strictly blocked, routes to local |
| `RESTRICTED` | NO | YES | OpenAI strictly blocked, routes to local |
| `CRITICAL` | NO | YES | OpenAI strictly blocked, routes to local |
| `INTERNAL` | Configurable | YES | Policy-dependent |
| `PUBLIC` | YES | YES | OpenAI permitted |

## 2. Adversarial Sanitization
- Prompt injection detection active via `securePromptContext`.
- Malicious instructions attempting cloud data exfiltration are quarantined in `<untrusted_user_content_potential_injection>` delimiters.
