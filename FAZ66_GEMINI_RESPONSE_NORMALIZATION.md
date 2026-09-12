# FAZ 66 — Gemini Response Normalization Report

## 1. Canonical Schema Transformation
The adapter maps raw Gemini API responses into the canonical ONLUNET ZEKA proposal contract:
- **Input**: `rawJson.candidates[0].content.parts[0].text`
- **JSON Parsing**: Extracts structured operations, proposed files, tests, risks, and assumptions.
- **Markdown Stripping**: Robust regex stripping of ```json ... ``` blocks if emitted by model.
- **Fallback Wrapping**: If raw text is non-JSON, automatically wrapped in `{ rationale: textContent }`.

## 2. Mandatory Output Invariants
```javascript
{
  ...parsedPayload,
  model: resolvedModel,
  providerId: cleanProviderId,
  latencyMs,
  usage: { inputTokens, outputTokens, totalTokens },
  cost: costInfo,
  finishReason: candidate.finishReason || 'STOP',
  rawContent: textContent,
  output: textContent,
  proposalOnly: true,
  executionAuthorized: false,
  isProposal: true
}
```
