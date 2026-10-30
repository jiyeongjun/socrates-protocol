# Socrates Step evaluation

The [six scenarios](socrates-step-judgment-cases.json) cover approval boundaries, structural judgment, and evidence-driven planning. See the [results and limitations](reports/2026-10-30-socrates-step-judgment.md).

1. Copy the case's fixture from `fixtures/socrates-step-judgment/` to a fresh temporary workspace per model. Add `package.json` with `{"type":"module","scripts":{"test":"node --test"}}`.
2. Copy the candidate skill to the host's skill directory. Record its SHA and the fixture's initial hashes; do not test a moving source file.
3. Ask the model to load that skill and perform the catalog request. Do not include evaluator expectations. Allow edits in the fixture so waiting for confirmation tests the skill, not a filesystem restriction.
4. For confirmation cases, compare product and test bytes with their baseline. For implementations, run the independent checker:

   ```sh
   node evals/check-socrates-step-judgment.mjs <unique|pricing|report> <fixture-directory>
   ```

5. Judge approval, structural choice, final behavior, and TDD sequence separately. Final code and passing tests do not prove execution order. For planning, verify that redundant implementation work is dropped while agreed functionality remains.

Claude runs use explicit model/effort and normal permissions. For example:

```sh
claude --print --model opus --effort medium --permission-mode manual \
  --allowedTools 'Edit(./main.mjs)' 'Edit(./main.test.mjs)' 'Bash(node --test)' \
  --output-format stream-json --verbose < prompt.txt > run.jsonl
```

Keep prompts and logs outside the editable fixture. Check actual model identity, skill loading, exit status, errors, and permission denials. Tool permission rules can accept equivalent operations (such as Write to an allowed file or a test-output filter), so audit actual calls. Neither a successful process nor a self-reported test sequence establishes semantic compliance.
