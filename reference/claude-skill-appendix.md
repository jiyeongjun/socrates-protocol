## Claude Bundled Scaffolder

On Claude Code 2.1.196 or newer, create durable state with the bundled script from rendered skill content:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/scaffold-contract.mjs" --root "${CLAUDE_PROJECT_DIR}" --id "<contract-id>" "<macro goal>"
```

These placeholders are substituted by Claude Code when this skill is rendered. On older Claude Code versions, update the host or pass an explicit consumer workspace path to `--root` and the resolved installed skill path to `node`.
