#!/usr/bin/env node
// Scaffold contract-index.md and contracts/contract-001.md for a new macro goal.
// Usage:
//   node scripts/scaffold-contract.mjs "<one-line macro goal>"
// Creates files only if they do not already exist; never overwrites.
// Run from the workspace root where contract-index.md should live.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const macroGoal = process.argv[2];

if (!macroGoal) {
  console.error('Usage: node scripts/scaffold-contract.mjs "<macro goal>"');
  process.exit(2);
}

const cwd = process.cwd();
const indexPath = path.join(cwd, "contract-index.md");
const subcontractDir = path.join(cwd, "contracts");
const subcontractPath = path.join(subcontractDir, "contract-001.md");

if (existsSync(indexPath)) {
  console.error(`Refusing to overwrite existing ${indexPath}`);
  process.exit(1);
}
if (existsSync(subcontractPath)) {
  console.error(`Refusing to overwrite existing ${subcontractPath}`);
  process.exit(1);
}

const now = new Date().toISOString();

const indexContent = `# Contract Index

## Macro Goal
${macroGoal}

## Success Criteria
- [ ] (state the testable end state)

## Scope
- (list the in-scope surfaces)

## Non-Goals
- (list things explicitly out of scope)

## Protected Surfaces
- (APIs, schema, persisted fields, auth, billing, deletion, config, production, external actions)

## Decisions
- (durable decisions made with the user)

## Open Questions
- (unresolved questions blocking further progress)

## Subcontracts
| ID  | Path                       | Task              | Status   | Next Step    | Verification          |
|-----|----------------------------|-------------------|----------|--------------|-----------------------|
| 001 | contracts/contract-001.md  | (one-line task)   | proposed | (next step)  | (verification method) |

## Current Status
Active subcontract: 001 (proposed)
Last updated: ${now}
`;

const subcontractContent = `---
task: "(one-line task summary for subcontract 001)"
status: "proposed"
knowns:
  - "(known fact 1)"
unknowns:
  - "(unknown 1)"
next_step: "(the immediate next step)"
updated_at: "${now}"
---

# Subcontract 001

## Inputs
- (artifacts, files, decisions feeding this subcontract)

## Completion Criteria
- [ ] (testable criterion 1)
- [ ] (testable criterion 2)

## Mutation Plan
1. (step 1)
2. (step 2)

## Verification
- (the narrowest relevant check that proves the change works)

## Work Log
- ${now}: created via scripts/scaffold-contract.mjs

## Result
(filled in at closure)
`;

await mkdir(subcontractDir, { recursive: true });
await writeFile(indexPath, indexContent, "utf8");
await writeFile(subcontractPath, subcontractContent, "utf8");

console.log(
  `Created:\n- ${indexPath}\n- ${subcontractPath}\n\n` +
    `Next: edit the placeholders, set subcontract 001 to "aligned" once the macro goal and first decision are aligned with the user, then start execution.`
);
