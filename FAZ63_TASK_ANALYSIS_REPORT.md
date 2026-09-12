# FAZ 63 — Task Analysis & Complexity Report

## 1. Task Taxonomy
FAZ 63 introduces the **Intelligent Task Analyzer** (`src/providers/task-analyzer.js`). The analyzer categorizes user intent into 15 canonical task types:

```text
1. GENERAL_QA             9.  VISION_ANALYSIS
2. CODING                10. DOCUMENT_ANALYSIS
3. CODE_REVIEW           11. TRANSLATION
4. REASONING             12. CREATIVE_WRITING
5. SUMMARIZATION         13. DATA_ANALYSIS
6. CLASSIFICATION        14. AGENT_PLANNING
7. EXTRACTION            15. TOOL_SELECTION
8. STRUCTURED_GENERATION
```

---

## 2. Deterministic Complexity Scoring
Complexity is evaluated without recursive LLM self-calling:
- **LOW**: Short prompts (< 500 chars), single-step QA.
- **MEDIUM**: Code refactoring, structured JSON generation.
- **HIGH**: Deep reasoning, tool calling, document analysis.
- **CRITICAL**: Formal proofs, multi-agent orchestration plans, `SECRET` / `RESTRICTED` data.

---

## 3. Requirements Extraction Contract
The analyzer outputs a strictly typed requirements profile:
```javascript
{
  taskType: 'CODING',
  requiredCapabilities: ['TEXT', 'STRUCTURED_OUTPUT'],
  dataClassification: 'INTERNAL',
  complexity: 'MEDIUM',
  qualityRequirement: 'MEDIUM',
  latencyRequirement: 'STANDARD',
  costSensitivity: 'MEDIUM'
}
```
