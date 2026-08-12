# Orchestration And Host Binding

## Flow

1. Use the host's normal workflow unless a Socrates boundary is actually present.
2. Bound and align only the protected decision; decide durable-file need separately.
3. If durable state is justified, create the fewest independently recoverable subcontracts.
4. Keep one mutating subcontract active per shared workspace and close the macro goal only after its criteria pass.

## Parallel Work

Delegate only when a distinct read-only workstream materially helps. Claude role agents expose `Read`, `Grep`, and `Glob`; Codex role agents request a read-only filesystem sandbox. Role agents cannot grant approval or authorize the main agent.

## Host-Native Agents

| Role | Codex agent | Claude agent |
|---|---|---|
| exploration | `socrates-explore` in `.codex/agents/*.toml` | `socrates-explore` in `.claude/agents/*.md` |
| alignment/planning | `socrates-plan` | `socrates-plan` |
| narrow verification | `socrates-verify` | `socrates-verify` |
| closure evaluation | `socrates-evaluate` | `socrates-evaluate` |

Native agents inherit the host-selected model and reasoning level. Codex TOML requests only read-only filesystem behavior; Claude frontmatter uses `model: inherit` with read-only tools and plan permission mode. Host, organization, invocation, trust, and parent-permission precedence still apply. The main agent performs any aligned mutation and commands unavailable to a role agent.

`model-policy.json` is advisory and neither host consumes it automatically. Explicit invocation remains `$socrates-contract` in Codex and `/socrates-contract` in Claude.

## Programmatic Tool Calling

PTC and delegation do not change the action's side-effect, approval, rollback, or verification boundary.
