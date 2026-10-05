# EGO: workflow

The user wants remote Git history, not just local saves. This instruction supersedes older notes saying not to push.

- Work in this existing checkout. The development server remains local; pushing source code does not authorize deployment.
- After each completed logical change, run `npm --prefix site run check` and appropriate checks for the change. Inspect `git diff`, stage only task-related files, and create a descriptive commit.
- The repository-local `.githooks/post-commit` automatically pushes to the current branch's configured upstream, including reachable annotated checkpoint tags. `.githooks/pre-push` checks JavaScript syntax first.
- The intended remote is `https://github.com/bkobetay/bey-perfume.git`. Local `codex/homepage-skeleton` tracks `origin/main`. Never force-push or rewrite shared history without a separate explicit request.
- Verify that the remote branch has the current commit after a change. A successful commit is not evidence of a successful push: the hook leaves commits safely local when authentication, network or remote divergence blocks uploading.
- If push fails, resolve the cause and retry `git push --follow-tags`. Clearly report any work still present only locally. Do not ask for renewed permission for ordinary pushes to this repository; the user has authorized them.
- Keep useful checkpoint tags for rollback. Preserve existing work and historical commits.
- Commit completed changes, not every intermediate file write. Do not create a filesystem watcher or background publication task.

For a fresh clone, enable versioned hooks with `git config --local core.hooksPath .githooks`. This working checkout has already been configured. Authentication is stored by Git/GitHub CLI, never in source, remote URLs, scripts or documentation.
