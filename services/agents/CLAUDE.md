# services/agents

ADK agents in TypeScript (D-021). All agents are read-only; no write-class tools.

## Rules

- Agents must not hold or access write credentials.
- Agent tool allowlists are defined in `config/agents/`.
- Every agent call is logged with session ID, rule IDs evaluated, and evidence collected.
