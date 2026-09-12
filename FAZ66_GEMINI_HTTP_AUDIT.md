# FAZ 66 — Gemini HTTP & Protocol Audit Report

## 1. Protocol Specifications
- **Transport**: Native Node.js `fetch` (HTTPS/TLS)
- **Base URL**: `https://generativelanguage.googleapis.com/v1beta`
- **Path Pattern**: `/models/${model}:generateContent`
- **HTTP Method**: `POST`
- **Authentication**: Header `x-goog-api-key: <KEY>` (preventing URL query param logging)
- **Content-Type**: `application/json`

## 2. Payload Structure
```json
{
  "systemInstruction": {
    "parts": [{ "text": "<Agent Role & Constraints>" }]
  },
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "<Task Prompt>" }]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0.2
  }
}
```

## 3. Network Defense & SSRF Isolation
- Zero external npm networking dependencies.
- Standard TLS certificate validation enabled.
- SSRF defense blocks loopback, link-local, and private addresses in production egress gates.
