# FAZ 66 — Gemini Model Catalog & Selection Report

## 1. Supported Models
| Model ID | Provider | Context Window | Input $/1M | Output $/1M | Primary Use Case |
|---|---|---|---|---|---|
| `gemini-1.5-flash` | Google | 1,000,000 | $0.075 | $0.30 | High throughput, low latency, general tasks |
| `gemini-1.5-pro` | Google | 2,000,000 | $1.250 | $5.00 | Deep reasoning, large codebase analysis |
| `gemini-2.0-flash` | Google | 1,000,000 | $0.100 | $0.40 | Next-gen fast multimodal inference |

## 2. Selection Routing
- Intelligent task routing engine dynamically selects `gemini-1.5-flash` for speed/cost efficiency, and `gemini-1.5-pro` when large context or intensive architectural reasoning is required.
