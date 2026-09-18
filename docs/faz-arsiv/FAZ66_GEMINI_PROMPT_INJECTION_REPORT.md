# FAZ 66 — Gemini Prompt Injection Defense Report

## 1. Structural Confinement
- System instructions are isolated in `systemInstruction.parts`.
- User task prompts are isolated in `contents[role=user]`.

## 2. Authority Escalation Immunity
- Invariant: Model responses attempting to set `executionAuthorized: true` or `proposalOnly: false` are discarded. The adapter wrapper guarantees that `executionAuthorized` is ALWAYS `false` and `proposalOnly` is ALWAYS `true`.
