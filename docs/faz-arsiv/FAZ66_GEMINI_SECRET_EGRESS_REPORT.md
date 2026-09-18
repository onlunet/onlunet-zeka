# FAZ 66 — Gemini Secret Egress Defense Report

## 1. Secret Detection Patterns
- Google AI Studio Keys: `AIza[0-9A-Za-z-_]{30,45}`
- OpenAI Keys: `sk-[A-Za-z0-9_-]{20,}`
- Anthropic Keys: `sk-ant-[A-Za-z0-9_-]{20,}`
- Authorization / Bearer Tokens & Private Keys.

## 2. Header & Error Sanitization
- Headers scrubbed: `x-goog-api-key`, `authorization`, `x-api-key` -> `***REDACTED***`.
- Error messages & stack traces cleansed before reaching caller or logs.
