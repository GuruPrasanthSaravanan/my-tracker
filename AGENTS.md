# Working conventions for this repo

## No local Node/npm in the assistant's sandbox

This machine has no Node.js/npm installed (confirmed 2026-08-22 - not on PATH,
not in any common install location). `npm run lint`, `npx vitest run`, and
`npm run build`/`npm run dev` **cannot be run locally** by the assistant.
Don't waste time re-checking this every session unless the user says they've
installed Node.

## Verification is CI-gated instead

`.github/workflows/deploy.yml` runs on every push to `main`:
`npm ci` -> `npm run lint` (oxlint) -> `npx vitest run` -> `npm run build` -> deploy to GitHub Pages.
A failing lint/test/build step stops the job, so nothing broken ever reaches
the deployed PWA. This is the actual verification gate for this repo - since
there's no local dev loop available, **push is how you find out if something
is broken**, not a separate optional step after "it looks right."

To check a run's result without a local `gh` CLI or MCP GitHub integration,
poll the public API (no auth needed, repo is public):
```powershell
Invoke-RestMethod -Uri "https://api.github.com/repos/GuruPrasanthSaravanan/my-tracker/actions/runs?branch=main&per_page=1" -Headers @{ "User-Agent"="devin-cli" }
```
Check `.status` (`in_progress`/`completed`) and `.conclusion` (`success`/`failure`) of the first run.

## Standard workflow for every bug fix / feature (per user request, 2026-08-22)

For every change, not just on request:
1. Make the code change.
2. Update `docs/superpowers/mytracker-bugs-and-lessons.md` with a new numbered
   section (symptom/root cause/fix, following the existing entries' format),
   plus the "Last updated" line at the bottom. This doc lives in `personal/docs/`,
   **outside** this git repo (`personal/` itself is not a git repo) - it never
   needs to be pushed, just saved.
3. Commit in `my-tracker` with a descriptive message (see root-level global
   rules for the commit format/trailer).
4. Push to `origin/main` - this is not optional/deferred, it's the actual
   "ship it" step (see above: no local build loop exists, and the GitHub
   Pages PWA only updates on push+CI-deploy, see §32 in the bugs-and-lessons
   doc for how this bit the user once already).
5. Poll the Actions run (see above) and report pass/fail back to the user
   rather than assuming success once pushed.

## Deployment

- Static PWA deployed to **GitHub Pages** via GitHub Actions
  (`.github/workflows/deploy.yml`), triggered only on push to `main`.
- Base path `/my-tracker/` (see `vite.config.js`) - this is not deployed at a
  domain root.
- Registered with `registerType: 'autoUpdate'` - an already-open/installed
  PWA tab may need to be fully closed and reopened (sometimes twice) after a
  new deploy before it picks up the new service worker/assets.
