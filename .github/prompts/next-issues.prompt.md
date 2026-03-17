# List next backlog issues

Take a look at [docs/issue-status.md](../../docs/issue-status.md) and the [Suggested implementation order](../../docs/features.md#suggested-implementation-order) in [docs/features.md](../../docs/features.md), then list the next 10 issues that should be implemented.

## Instructions
- Use the suggested implementation order from [docs/features.md](../../docs/features.md).
- Cross-check current completion state in [docs/issue-status.md](../../docs/issue-status.md).
- Skip issues already marked as done.
- Prefer issues not started or in progress.
- Return exactly the next 10 remaining issues in backlog order, or fewer if fewer remain.
- Format each result on its own line as:
  - `Epic 1 issue 1`
  - `Epic 1 issue 3`
- Do not include descriptions, bullets, numbering, or extra commentary.

## Expected workflow
1. Read [docs/issue-status.md](../../docs/issue-status.md).
2. Read the [Suggested implementation order](../../docs/features.md#suggested-implementation-order) in [docs/features.md](../../docs/features.md).
3. Filter out completed issues.
4. Output the next 10 issues in the required format.
