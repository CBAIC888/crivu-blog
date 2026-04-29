# Deployment Runbook

## Goal
- Use one deployment path only.
- Avoid repeated trial-and-error pushes.
- Stop immediately if the public site does not move to the pushed commit.

## Standard Deploy Flow
1. Confirm local state once:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog status --short`
   - If unrelated changes exist, stop and separate them first.
2. Validate the change locally before pushing:
   - Syntax check changed JS files with `node --check`.
   - If article routing changed, verify the function modules import cleanly.
3. Create one commit only:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog add -A`
   - `git -C /Users/cbaic/Desktop/開發/網站/blog commit -m "<message>"`
4. Sync with remote once before push:
   - `GIT_TERMINAL_PROMPT=0 git -C /Users/cbaic/Desktop/開發/網站/blog fetch origin main`
   - `git -C /Users/cbaic/Desktop/開發/網站/blog status -sb`
   - If branch is behind, rebase once:
     - `GIT_TERMINAL_PROMPT=0 git -C /Users/cbaic/Desktop/開發/網站/blog rebase origin/main`
5. Push once:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog push origin main`

## Post-Deploy Verification
- Verify GitHub accepted the push and note the exact commit SHA.
- Check these public URLs:
  - `/`
  - `/articles`
  - `/issues`
  - `/about`
  - `/articles/<slug>`
- For article pages, confirm returned HTML already contains:
  - `<title>`
  - `<meta name="description">`
  - `<h1>`
  - body text

## If Public Site Still Shows Old HTML
- Do **not** keep pushing.
- Assume deployment chain is broken until proven otherwise.
- Check these exact items in Cloudflare Pages:
  - Production branch is `main`
  - Latest production deployment commit SHA matches GitHub
  - Project root points to this repo root
  - Pages Functions are enabled and detected
  - Custom domain `cbc688.com` is attached to the same project
  - Cache is purged after a successful production deploy

## Known Failure Patterns
- Git push succeeds but public HTML stays old:
  - Usually wrong Pages project, wrong production branch, stale deployment, or custom domain bound to another project.
- `main -> main (fetch first)`:
  - Remote advanced; fetch/rebase once, then push.
- `index.lock` errors:
  - Another git command was started in parallel.
  - Never run `git status`, `git add`, `git commit`, `git pull`, `git push` in parallel.

## Rules
- Never redeploy multiple times just to “see if it works”.
- One code change batch should map to one commit and one push.
- If one successful push does not change production, switch from “deploying” to “fixing deployment configuration”.
