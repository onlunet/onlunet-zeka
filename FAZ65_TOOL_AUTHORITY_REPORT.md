# FAZ 65 — Tool Proposal Boundary Report

## 1. Tool Calling Constraints
- AI cannot execute CLI, shell, or HTTP mutation directly.
- AI-generated tool calls are structured as:
  ```json
  {
    "tool": "execute_shell",
    "arguments": { "command": "..." },
    "proposalOnly": true,
    "executed": false,
    "executionAuthorized": false
  }
  ```
- Direct tool execution is structurally impossible without external human / admission pipeline approval.
