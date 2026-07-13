# Orchestration And Host Binding

## Flow

1. Explore current state read-only and classify safe-local versus Socrates work.
2. Align protected decisions before their mutation; decide durable-file need separately.
3. If durable state is justified, create the fewest independently verifiable subcontracts.
4. Keep one mutating subcontract active per shared workspace; verify and update it before the next.
5. Close the macro contract only after all success criteria pass.

## Parallel Work

Apply the main runtime’s parallel-work boundary. Claude role agents expose only `Read`, `Grep`, and `Glob`; Codex role agents request read-only filesystem sandboxing and explicitly forbid external writes through inherited tools. Role agents cannot grant approval or authorize the main agent.

## Host-Native Agents

| Role | Codex agent | Claude agent |
|---|---|---|
| exploration | `socrates-explore` in `.codex/agents/*.toml` | `socrates-explore` in `.claude/agents/*.md` |
| alignment/planning | `socrates-plan` | `socrates-plan` |
| narrow verification | `socrates-verify` | `socrates-verify` |
| closure evaluation | `socrates-evaluate` | `socrates-evaluate` |

When a named agent is spawned, Codex native TOML supplies its requested model/reasoning/read-only-filesystem defaults; project TOML also requires a trusted repository, and inherited connectors or MCP tools remain subject to host policy. Claude agent frontmatter supplies requested alias/tools/permission defaults subject to organization, invocation, environment, and parent-permission precedence. Claude's structural tool allowlist and Codex's requested filesystem sandbox are different boundaries; neither authorizes external actions. The main agent performs aligned mutation and runs any verification command unavailable to a role agent.

`model-policy.json` is advisory documentation for fallback/evaluation policy. Neither host consumes it automatically. Explicit skill invocation remains `$socrates-contract` in Codex and `/socrates-contract` in Claude.

## Programmatic Tool Calling

Apply the canonical PTC boundary in the main runtime. Host delegation changes execution location only; it does not change allowed tools, side effects, stopping, or approval.
