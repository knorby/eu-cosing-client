# docs/

Living documentation for design, architecture, and decisions.

## Structure

- `decisions/` — Architecture Decision Records (ADRs). Create a new markdown
  file per significant decision, using the template below.

## ADR template

```markdown
# ADR-NNNN: <Title>

- **Status:** Proposed | Accepted | Superseded by ADR-MMMM | Deprecated
- **Date:** YYYY-MM-DD

## Context

Why is this decision needed? What forces are at play?

## Decision

What was decided?

## Consequences

What are the trade-offs, risks, and follow-up actions?
```

Number ADRs sequentially (`ADR-0001`, `ADR-0002`, ...). Keep each record concise
and factual; supersede rather than rewrite accepted records.
