# Changelog

## Unreleased

### 0.3.0

#### Added
- Flags for every prompt: `--platform`, `--framework`, `--ws-url`, `--broadcast-url`, `--no-deploy`, `--skills` / `--no-skills`, `--yes`, `--help`. With `--yes` and both URLs the CLI runs without input, for CI and for AI agents. `--yes` also skips the deploy step, so it never blocks on a prompt or pushes to production on its own.
- `verify-slide-quiz` bin (`npx -p create-slide-quiz verify-slide-quiz --site <url> --platform <netlify|vercel> --ws-url <wss://...>`). Checks the audience page, both functions, and a broadcast round trip over the WebSocket. Needs Node 22.
- Copies the agent skills shipped in `slide-quiz` 0.6+ into `.claude/skills/` (asked interactively, implied by `--yes`).
- Writes `vercel.json` for Slidev decks on Vercel. Without it Vercel served the source tree.
- GitHub Actions: unit tests plus a real scaffold-and-build job on every PR, and an "E2E deploy" workflow that deploys to Vercel and Netlify and verifies the result when secrets are configured.
- CONTRIBUTING.md, SECURITY.md, issue and PR templates, this changelog.

#### Changed
- Installs `valibot` explicitly alongside `@anycable/serverless-js`; the functions import it.
- Writes `public/_redirects` for Slidev on Netlify itself instead of copying it from the addon, which stops shipping that file in 0.4.0.
- Skips the `package.json` that sits next to the function sources when copying them into `api/` or `netlify/functions/`.
- Crash reports now point at this repo's issue template instead of slide-quiz's.

## 0.2.0, 2026-03-13

- Default to results-only slides in scaffolded projects

## 0.1.6 and earlier

See the [git history](https://github.com/anycable/create-slide-quiz/commits/main).
