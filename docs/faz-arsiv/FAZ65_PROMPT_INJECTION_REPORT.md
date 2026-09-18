# FAZ 65 — Prompt Injection Defense Report

## 1. Pre-Flight Inspection
- All prompt contexts pass through `securePromptContext`.
- Injections matching adversarial patterns are flagged (`injectionDetected: true`).
- Content is quarantined within `<untrusted_user_content_potential_injection>` XML-style delimiters.
- Exfiltration instructions are rendered passive data.
