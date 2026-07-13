# Distributed Systems, Queues, And Caching

Load this only when work crosses processes, services, databases, queues, caches, or asynchronous workers.

- Name state ownership, transaction boundaries, consistency expectations, and rollback/reconciliation behavior.
- Define retry/idempotency keys, ordering, duplicate handling, poison-message behavior, dead-letter policy, and replay safety where queues are involved.
- Distinguish an already-started promise from a task factory when execution policy needs retry, timeout, cancellation, batching, or concurrency limits.
- Treat moves between client, server, queue, worker, database, cache, and vendor systems as behavior changes requiring cross-boundary verification.
- Build cache keys from normalized inputs with only result-changing axes; sort/deduplicate order-independent values and never key on raw request objects or observability-only fields.
- Split services only when ownership, scaling, failure isolation, data boundaries, or deployment cadence justify the operational cost.
