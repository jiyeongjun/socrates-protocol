# Sources and adaptation decisions

Reviewed 2026-10-30. This skill is an independent adaptation, not a Kent Beck-authored or endorsed package. Repository evidence is pinned to BPlusTree3 revision `ca80e4d85a99cd0af2effe717f709d43e80403bc` (2025-09-12). Commits demonstrate recorded changes, not every intermediate test run or the effectiveness of a workflow.

## Published framing

- Kent Beck, [Augmented Coding: Beyond the Vibes](https://newsletter.kentbeck.com/p/augmented-coding-beyond-the-vibes), 2025-06-25. Appendix 1 describes test-first increments and separate structural changes. The narrative identifies repetition, unsolicited functionality, and disabled tests as intervention signals. It also admits remaining accidental complexity. We preserve incremental verification, not a claim that the prompt guarantees quality.
- Kent Beck, [Earn And Learn](https://newsletter.kentbeck.com/p/earn-and-learn), 2026-02-18. Distinguishes one-time completion from continuing development that must preserve future options. This motivates checking present obstacles to subsequent work. It does not specify mandatory user approval per increment or a fixed allocation of time to refactoring.

## Concrete repository evidence

| Evidence | What it supports | Adaptation |
| --- | --- | --- |
| [Generalization after green, 61b1a29](https://github.com/KentBeck/BPlusTree3/commit/61b1a298e9e5879e9c2f21eb4b2bce567219b66e) | The plan was amended to seek simpler, more general solutions after a specific test passes. | Minimal implementation must not accumulate hardcoded special cases; assess actual structural friction after green. |
| [Bug reproduction instruction, 8c494da](https://github.com/KentBeck/BPlusTree3/commit/8c494da24588e17d16f067f85abadb98e532c294) | Repository instructions add an API failure and a smaller reproduction for defects. | Use a second reproduction when it isolates a distinct cause, rather than duplicating assertions mechanically. |
| [Plan removal, ff302bc](https://github.com/KentBeck/BPlusTree3/commit/ff302bc8e882dceefb3d27fe60149b29f63712a9) | The obsolete plan was removed on June 5, before the article was published. | Do not require a permanent plan.md file merely because the published prompt names one. |
| [Fuzz tests excluded from ordinary runs, 623afbb](https://github.com/KentBeck/BPlusTree3/commit/623afbbf807c99c58420e7d00fe1689919556299) | Slow fuzz runs were separated from the normal loop with explicit run commands. | Distinguish fast verification from risk-specific checks and accurately report omissions. |
| [Differential range tests](https://github.com/KentBeck/BPlusTree3/blob/ca80e4d85a99cd0af2effe717f709d43e80403bc/rust/tests/range_differential.rs) | Tests compare boundary and missing-key behavior with BTreeMap. This is later repository evidence, not a quotation from the June article. | Use reference implementations where their contracts match the intended behavior. |
| [Fuzz-derived patterns](https://github.com/KentBeck/BPlusTree3/blob/ca80e4d85a99cd0af2effe717f709d43e80403bc/python/tests/test_fuzz_discovered_patterns.py) | Recorded operation sequences check tree invariants during mutation. | Preserve reproducible failure sequences and meaningful assertions. |
| [Diagnostic invariant test](https://github.com/KentBeck/BPlusTree3/blob/ca80e4d85a99cd0af2effe717f709d43e80403bc/python/tests/test_invariant_bug.py) | The function prints invariant results without asserting them. This file alone does not establish invariant enforcement. | Verify test sensitivity; do not equate a test-like name or successful exit with a checked contract. |
| [Engineering conventions](https://github.com/KentBeck/BPlusTree3/blob/ca80e4d85a99cd0af2effe717f709d43e80403bc/agent.md) | Later project instructions call for targeted performance work and neighboring-operation checks. | Measure relevant workloads; do not transplant B+ tree commands or project-specific feature-flag restrictions into every codebase. |

## Deliberate product decisions

Per-step proposal and confirmation is this user's requested Socrates interaction design. It is not attributed to Beck as a universal requirement. Explicit bounded delegation reuses approval; a new contract or expanded scope reopens only the affected decision.

Socrates establishes intended behavior and consequential choices. Socrates Step governs execution cadence after or alongside that agreement. Learning and explanation requests remain outside this implementation workflow. Neither skill guarantees correctness, understanding, or maintainability solely through its prompt.

We do not copy language-specific style preferences, mandate a rewrite in Python, enforce refactoring on every green test, require automatic commits, or clean all pre-existing warnings as a side effect of a bounded change. These would turn context-specific practices into unrelated obligations.
