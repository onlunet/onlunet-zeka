# FAZ 66 — Gemini Tool Proposal Authority Report

## 1. Declarative Proposals
- Tool operations emitted by the model (`CREATE_FILE`, `REFACTOR`, `RUN_TEST`) are descriptive data objects (`{ type, target, description }`).
- Tool objects contain ZERO executable functions (`typeof op.run === 'undefined'`).

## 2. Gated Execution
- Tool operations must pass through the authoritative verification pipeline and preflight admission gate before any filesystem or command execution occurs.
