# Automation And External Interaction

Load this only for agents, PTC, browsers, APIs, messages, schedules, or other external interaction.

- Inspect targets and authentication state read-only before mutation.
- For each delegated role, define allowed tools, inputs/outputs, stopping condition, and timeout before dispatch.
- Define timeout, retry, and recovery behavior in addition to the main runtime’s canonical PTC boundary.
- Prefer documented APIs, stable semantic selectors, and idempotent operations over coordinates or timing guesses.
- Treat login, checkout, ordering, form submission, account changes, deletion, payment, messaging, deployment, and production writes as protected actions under the main trust boundary.
- For recurring automation, define rate limits, cancellation, missed-run behavior, and failure visibility before activation.
