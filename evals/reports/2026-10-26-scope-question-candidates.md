# Scope and question refinements — release held

**Decision: keep v2.1.1 installed. Do not release this candidate.** Three complete candidate runs were collected (216 responses). Some targeted warnings improved, but new semantic failures appeared, so version bump, merge, tag and global installation were withheld.

The 3 regressions from the previous report are a subset of its 15 warnings, not 3 additional cases. In the final candidate those original 15 became **8 pass, 6 warn, 1 fail**. Of the prior three regressions, Haiku high minimum-equivalent and Sonnet high transfer-repair passed; Haiku low invalid-premise still warned.

## Root causes and attempted changes

- Evidence preparation was being printed as extra exceptions and caveats. Narrow-result/cause guidance and explicit treatment of supplied premises tried to reduce this; some models still hedged stipulated facts or overstated diagram effects.
- A new scenario was not necessarily a useful check. The candidate asked models to compare mistaken/correct predictions, choose the shortest differentiating case, and provide all prior outcomes needed to reach later steps.
- “Keep unresolved” was being expanded into an agenda of later choices. The candidate separates one-decision turns from a full implementation agreement and makes recommendations conditional on an actual priority.
- The last candidate consolidated overlapping prose after a longer intermediate instruction set still produced errors. These are hypotheses from observed outputs, not proven causal explanations of model behavior.

## Results and judge uncertainty

| Review | Pass | Warn | Fail |
| --- | ---: | ---: | ---: |
| historical-v2.1.1 | 57 | 15 | 0 |
| round1-baseline | 50 | 22 | 0 |
| round1-candidate | 60 | 11 | 1 |
| round3-baseline | 43 | 29 | 0 |
| round3-candidate | 51 | 20 | 1 |
| round3-holdouts | 9 | 1 | 0 |

Round 2 completed all 72 executions but was rejected during primary inspection and was not fully graded. It is not a missing successful run: all its responses are retained in the JSON. Haiku low used `take([]).length === 0` instead of `items.length === 0`; Haiku high shifted the changed-evidence review into external-API and retry-policy questions.

Round 1 introduced a conservatively graded indeterminate question: Luna high specified failure on call 1 and success on call 3 without stating call 2's outcome. The second candidate clarified shortest-scenario selection and reachability. The final candidate removed overlapping instructions but retained a release-blocking review-to-policy shift.

The final paired review improved 16 warnings to passes, retained 12 warnings, changed one warning to failure, and introduced eight pass-to-warning findings. The unchanged baseline itself scored 50/22/0 in one pass and 43/29/0 in another, versus its historical 57/15/0. **That judge variability is visible, not hidden by rewriting the old report.** The headline release decision rests on the concrete failure and regressions, not on interpreting those counts as statistical proof.

### Release-blocking final response

Haiku low, changed-evidence (`T114`) asserted a definite double charge, then ended a learning review by inventing an open policy decision about treating timeouts as new charges versus already attempted IDs. The user had stated the desired no-duplicate policy and asked for an explanation, not a new design decision. The independent reviewer graded this **fail**; primary inspection agrees. This is not a packaging or test-runner failure.

## Original 15 findings

| Model / effort / case | Prior regression? | Final verdict | Cause |
| --- | --- | --- | --- |
| claude-sonnet-5-5 / low / intent-boundary | no | pass | Scope/evidence: a recommendation invented why requests usually repeat and listed unrelated pending choices. |
| claude-haiku-5-5 / high / invalid-premise | no | pass | Scope: an already correct answer spawned a null/undefined tangent. |
| gpt-6-luna / high / transfer-repair | no | warn | Question selection: a changed scenario still gave the same three-call prediction under both models. |
| claude-opus-5-5 / low / changed-evidence | no | pass | Question selection: the normal-success branch could not distinguish the timeout misconception. |
| claude-sonnet-5-5 / high / transfer-repair | yes | pass | Question selection: the final-slot boundary did not test the mistaken fixed-quota model. |
| claude-sonnet-5-5 / low / question-opt-out | no | pass | Scope: unsolicited normalization suggestion and extra input cases. |
| claude-haiku-5-5 / low / changed-evidence | no | fail | Question leakage and evidence: the check repeated the old/new trace and a diagram overstated the external effect. |
| claude-haiku-5-5 / low / invalid-premise | yes | warn | Scope: a repaired false premise spawned unrelated inputs; the last candidate also suggests empty-array indexing can fail. |
| claude-haiku-5-5 / high / changed-evidence | no | warn | Evidence: diagram and prose asserted completed duplicate charges although only a second call was shown. |
| claude-haiku-5-5 / low / question-opt-out | no | pass | Scope: a direct behavior explanation became a conditional normalization fix. |
| claude-haiku-5-5 / high / minimum-equivalent | yes | pass | Evidence: supplied broker behavior was treated as unknown; caution was applied to the premise instead of an unproven effect. |
| gpt-6-sol / low / changed-evidence | no | warn | Question leakage: the exact timeout state was already answered in the trace. |
| gpt-6-astra / low / changed-evidence | no | warn | Question selection: both models predicted no second call after ordinary success. |
| claude-opus-5-5 / low / intent-boundary | no | pass | Scope: keeping choices unresolved became an unsolicited next-decision agenda; recommendation assumed a repeat-request base rate. |
| claude-sonnet-5-5 / high / question-opt-out | no | warn | Scope: evidence caution became unnecessary caller/character-code commentary. |

## Validation and preserved boundaries

- Same six response prompts and unchanged [semantic rubric](../semantic-review.md). GPT-6 Luna/Sol/Astra and Claude 5.5 Haiku/Sonnet/Opus, each low/high. Tests use explicit skill contents and omit expected criteria from model inputs.
- Separate Claude Opus 5.5 high reviews used 144 shuffled anonymous responses per comparison (72 baseline + 72 candidate), in six batches of 24. The reviewer saw no model or version labels. All independent judgments, including borderline warnings, remain unaltered in the evidence.
- Five [held-out prompts](../scope-question-holdouts.json) / [prior holdouts](../evidence-transfer-holdouts.json) were exercised on final Claude Sonnet 5.5 high and GPT-6 Sol high. Primary review: 9 pass, 1 warning. The warning is terminology: Claude called a length check a null check despite giving the correct outputs and flow. Requested exceptions, supported practice and a requested policy agenda were not suppressed.
- Native Claude Sonnet 5.5 high passed the implementation workflow on all three candidate sources: no file mutation on three pre-approval turns; implementation after confirmation; hidden assertions for ordering, partial failure, duplicates after failure, reset, exact matching, empty input and preserved legacy behavior. Already-approved edits and no-question explanations were also exercised.
- Native CLI permission denials were retained: round1 = 3, round2 = 0, round3 = 2. They involved verification-command forms or temporary paths. Permissions were not broadened; the model proceeded with allowed workspace tools. Hidden acceptance checks independently passed. Mechanical success does not override the semantic release failure.
- Final repository checks: 63 tests; 23 static cases / 45 checks; generated skill parity; both skill-creator validators. These verify packaging and declared rules, not reliable model compliance.
- GPT uses six vignettes per agent context; Claude uses one fresh CLI context per vignette. This is the same host arrangement as the prior baseline, but it permits GPT cross-case contamination and precludes fair model ranking. One such final Luna low response referred to a charge in the commit/ack case.

## Evidence and installation status

The [machine-readable report](2026-10-26-scope-question-candidates.json) preserves all three candidate matrices, both blinded comparisons, source hashes, the original-15 mapping, holdout responses and native-workflow summaries. Raw account/session traces stay in ignored private evaluation artifacts. One failed GPT agent was retried with the same model/effort before any response existed; no semantic answer was replaced merely to obtain a pass.

The repository and installed release remain **v2.1.1**. The unmerged branch contains only a proposed refinement and evaluation evidence. Existing global Codex and Claude installations must continue matching the released main branch; do not install this branch as an upgrade.
