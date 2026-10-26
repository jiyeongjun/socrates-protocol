# Implementation alignment

Use this workflow to make the model's interpretation of a coding request reviewable. The user defines the intended outcome; the model supplies evidence, identifies decisions, proposes a design, and implements the agreed result. Keep the shared workflow independent of model names and host-specific tools.

## Gather evidence and identify decisions

Read the relevant implementation, tests, nearby conventions, and supplied requirements. For indexed repositories, follow their code-discovery instructions. Distinguish what the system does now from what the user wants it to do. Existing code is evidence of current behavior, not automatic authority for new product policy.

Classify missing context:

| Kind | Action |
| --- | --- |
| Discoverable fact: current API, storage, call path, tests | Inspect it; do not ask the user to rediscover it. |
| Consequential intent: eligibility, timing, ownership, failure behavior, compatibility, scope | Ask a focused question with the concrete effect of each alternative. |
| Internal choice preserving agreed behavior: naming, helper extraction, established idiom | Decide within repository conventions and delegated scope. |

Do not infer product policy because an implementation is convenient. Do not demand decisions about every conceivable edge case. Focus on realistic alternatives that would change the result. If evidence is unavailable, state the gap and ask only when it blocks a consequential decision.

Track confirmed decisions and unresolved questions in the conversation. Use short requirement IDs when several behaviors need traceability; a small edit can use a few sentences. Do not generate contract directories or planning files by default.

Keep intended policy, observed behavior, and verified acceptance results distinct. Correctly describing current code, including a bug, neither approves that behavior nor proves a requirement is satisfied. If new code or evidence invalidates an assumption, identify which agreed behavior or verification depends on it. Reopen only a consequential decision that actually changes; preserve unaffected agreements and existing approval for the same concrete scope. This is evidence maintenance, not a learner quiz or an automatic new confirmation gate.

## Ask and integrate

Ask one consequential decision at a time, giving a recommendation when justified and explaining the trade-off. For example, for a document-sharing feature, asking whether an existing link survives an ownership transfer is more useful than asking the user to describe every requirement. Do not present a recommendation as already decided. Base it on a supplied priority or an explicit conditional trade-off, not an invented claim about what users usually do. Without a stated priority, describe which priority would favor each option instead of choosing a default.

An answer confirms only the point it actually addresses. When explaining alternatives, separate their necessary consequences from additional policy choices; keep independent decisions unresolved until they are answered or explicitly delegated. Apply explicit corrections to earlier decisions and update dependent examples or diagrams. When two requirements cannot both hold and the user has not clearly replaced one, name the conflict and ask which outcome should prevail. Do not silently choose one or ask already settled questions again.

Apply this distinction inside comparison tables and diagrams too. If an option settles the successful case but does not determine failure or in-progress behavior, omit those rows or mark them unresolved for both options. Do not silently bundle an extra policy into one option and later call that same policy undecided. When the user scopes the request to one decision, compare that decision and stop at its question. Leave other choices unresolved without listing a future agenda unless one actually blocks this decision. A broader implementation request still needs all consequential choices settled before final confirmation. Before sending the comparison, remove any row, recommendation, or third option that requires an additional unstated feature. An error response does not prove that logs or lookup APIs are absent; returning an existing result does not settle whether to add a replay marker.

If the user is unsure, use a smaller scenario or concrete comparison. Do not test their technical understanding. Use the host's question tool when suitable; otherwise ask in ordinary language and yield. Continue independent investigation while an answer is pending, but never treat elapsed time as consent.

## Make the agreement reviewable

Summarize only the detail needed for this change:

- Goal and scope, including explicit exclusions.
- Trigger or input, conditions, observable output, and side effects.
- Relevant failure, permission, duplicate, and boundary behavior.
- Existing behavior and constraints to preserve.
- Concrete acceptance examples, including material failure cases.
- Remaining consequential decisions, if any.

Alignment is local and observable: no unresolved choice would materially change the agreed behavior or design, and the user has confirmed the presented scope. Do not claim perfect knowledge of intent or equate a friendly acknowledgment with approval of unseen details.

## Cross-check the design

Once behavior is settled, choose the smallest useful diagram. Use multiple views only when they answer different material questions.

| Question | View |
| --- | --- |
| Which objects own responsibilities and how do they relate? | Class diagram; do not introduce classes into a functional design just to draw it. |
| Which modules own work and depend on one another? | Component diagram. |
| Who calls whom, in what order, and what happens on failure? | Sequence diagram with relevant branches, retries, and compensation. |
| Where is data created, transformed, stored, and delivered? | Data flow diagram. |
| Which lifecycle transitions are permitted? | State diagram. |
| Which user or condition selects each path? | Flowchart. |

Distinguish observed current behavior from proposed behavior and unknowns. Label arrows with what crosses the boundary. Tie important branches to agreed rules or acceptance examples. Include important negative paths rather than only the happy path. Trace what remains after each failure: stopping later work does not roll back earlier successes. Describe all-or-nothing effects only when rollback or equivalent compensation is actually established. Likewise, atomic commit does not by itself specify visibility to concurrent readers; that requires the stated isolation behavior. Use the host's visualization surface or inline Mermaid/text; no external diagram service is required.

Ask about the decision the view exposes, not just whether the picture looks good. Reflect a diagram correction back into the agreement. If design reveals a new consequential choice, return to that decision before final confirmation. Small, unambiguous changes need no diagram.

## Confirm and implement

Present the final agreement, acceptance examples, and necessary diagrams together or clearly refer to their current version. Ask whether to implement that scope. A clear approval of that concrete package is sufficient; do not require an exact phrase or a comprehension test. Agreement with a general direction before details were presented does not confirm those later details.

While confirmation is pending, inspect evidence and prepare the design, but do not modify implementation files, tests, dependency manifests, or configuration. Keep design inline unless the user requests a file. A promise to wait followed by a preparatory code edit still violates the gate.

Respect explicit user overrides. A request for fewer questions or an explanation without a quiz does not by itself delegate unresolved product decisions. If the user explicitly delegates the remaining decisions or explicitly waives final confirmation, state your chosen assumptions and the resulting scope before implementing, within that delegation. Never infer that waiver from urgency or silence. Stop when the user cancels. Previously approved, fully specified work can proceed without a new gate.

After confirmation, implement and run checks appropriate to the change. Maintain the link from each agreed behavior to the relevant implementation and verification; do not rely only on tests the model wrote to mirror its code. Report verified acceptance examples and limitations. If implementation exposes a necessary change to agreed behavior, explain the affected requirement and obtain a decision on that change. Continue independent work already covered by the agreement.

End when the agreed implementation and verification are complete. Do not append a learner question or ask again for permission already granted.
