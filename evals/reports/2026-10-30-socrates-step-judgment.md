# Socrates Step evaluation — 2026-10-30

Candidate SHA-256: `3a21d942af87a75ba61d25839b9f35374088de25a2c048d2ac938f39542f0b90`.

Six scenarios were evaluated in 17 task executions: six native-agent turns and eleven Claude runs, including retries. All used medium effort. This is a scenario matrix, not every scenario on every model. Native models were gpt-6-astra, gpt-6.1-sol, and gpt-6.1-terra; Claude aliases resolved to claude-opus-5-5, claude-sonnet-5-5, and claude-haiku-4-5-20251001. No model fallback was configured.

## Results

| Scenario | Observed behavior |
| --- | --- |
| User directly requests a small fix | Astra, Opus, and final-wording Haiku fixed the order bug without reconfirmation. Independent checks passed. |
| AI chooses a step from a broad goal | Sol, Sonnet, and final-wording Haiku proposed a step and left product/test files unchanged. |
| User explicitly requires confirmation | Terra and Haiku proposed the fix and waited without edits, including Haiku's final-wording rerun. |
| Structural improvement is useful | Astra and Opus centralized the calculation shared by quote, receipt, and preview. Independent checks verified 15% VIP discounts, rounding, unchanged non-VIP amounts, and public return shapes. |
| Structure is already adequate | Sol and Sonnet removed `.sort()` without extra abstractions. Independent checks verified order, input preservation, numeric values, and empty input. |
| Evidence changes the plan | Terra and final-wording Sonnet reused the existing CSV serializer, preserved JSON, questioned the unnecessary intermediate store, and retained history as the next user-facing requirement. Haiku did not complete this case. |

## Separate judgments and remaining failures

**Opus structural case:** authorization, structural judgment, behavior preservation, final behavior, and failure observed before behavioral implementation passed. **Strict one-example-at-a-time TDD was not followed.** After extracting and testing the shared calculation, one Edit changed the existing VIP expectations and added a rounding test before either example was run. Both then failed before the rate changed. The saved Edit ID is `toolu_01Vj4VkLgAynB1bY2zSjSj7v`. A Red run before implementation does not establish the stricter sequence.

**Haiku planning case:** the initial run recognized the formatter but unnecessarily sought approval again. More direct approval wording did not fix the targeted retry: it read the wrapper and test without inspecting the imported formatter, asked questions discoverable from that code, and stopped before implementing. Proposed CSV examples also differed from the formatter. This was a behavioral failure, not a permission block. The final wording did work for its simpler direct fix and explicit-confirmation cases. No further rules were added for this one model.

## Evidence and limits

The six native runs and first six Claude runs used the initial two-sentence revision. Final-wording retries covered four Haiku cases (direct, AI-selected, explicit confirmation, planning) and Sonnet planning. Earlier runs are not relabeled as evaluations of later bytes.

Parent checks inspected source and executed `evals/check-socrates-step-judgment.mjs`; confirmation cases used byte comparisons. Structural choices and plan revisions were reviewed semantically. Claude traces establish tool ordering. Native summaries report ordering but do not independently prove it.

All Claude processes exited 0 with `is_error=false`; the Haiku planning cases still failed semantically. Skills were loaded through successful local Reads or Skill injections matching the snapshot body. A Haiku retry first attempted a denied global read, then loaded the local skill. Incorrect fixture paths were corrected. Normal permission mode and bounded fixture permissions were retained; no bypass or fallback was used.

Source snapshots and raw transcripts remain locally under `.socrates-eval-results/2026-10-30-socrates-step-judgment/`; detailed prior reports are archived under `.socrates-eval-results/pr-cleanup/`. These local artifacts are not distributed. The [cases](../socrates-step-judgment-cases.json), [fixtures](../fixtures/socrates-step-judgment), and [procedure](../socrates-step-evaluation.md) support reproduction.

At evaluation time, repository tests passed 94/94, generated skills and 22 release assets verified, and existing static evaluations passed 23 cases / 45 checks. Removing the redundant earlier completion fixture reduces repository test count by one; model results are unchanged. These finite fixtures do not establish reliability for long-running projects, real backends, or performance workloads.
