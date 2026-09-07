# Contributing to create-slide-quiz

This is the scaffolder for [slide-quiz](https://github.com/anycable/slide-quiz). It detects a Reveal.js or Slidev deck, installs the right package, writes the config, audience page, and serverless functions, and optionally deploys. The quiz engine, the Slidev addon, the functions it copies, and the agent skills all live in the slide-quiz repo; this repo only decides where they go.

## Layout

| File | What it does |
|---|---|
| `index.mjs` | bin entry, calls `safeMain()` |
| `lib.mjs` | everything: detection, prompts, file writes, deploy |
| `scripts/verify-deploy.mjs` | the `verify-slide-quiz` bin, checks a deployed site end to end |
| `tests/` | vitest; prompts and `child_process` are mocked, files are written to a temp dir |

## Running

```bash
npm install
npm test
node index.mjs --help
```

To try the CLI against a real deck without publishing:

```bash
mkdir /tmp/deck && cd /tmp/deck
npm init -y && npm pkg set type=module
npm install @slidev/cli @slidev/theme-default
printf -- '---\ntheme: default\n---\n\n# Test\n' > slides.md
node /path/to/create-slide-quiz/index.mjs --yes --platform vercel --no-deploy \
  --ws-url wss://<cable>/cable --broadcast-url https://<cable>/_broadcast
```

Then deploy and run `node /path/to/create-slide-quiz/scripts/verify-deploy.mjs --site <url> --platform vercel --ws-url wss://<cable>/cable`. This is the check that found the Vercel function bugs in September 2026; unit tests cannot see them.

## Rules of thumb

- Every prompt needs a flag, so `--yes` plus the two URLs runs the whole thing without input. CI and agents depend on that.
- The CLI never writes secrets into source. The broadcast URL goes to `.env` (gitignored) and to the host's environment.
- Files that already exist are skipped, never overwritten. Re-running the CLI must be safe.
- Everything the CLI copies comes from `node_modules/slide-quiz` or `node_modules/slidev-addon-slide-quiz` at the version npm resolves. If a new engine release changes what it ships (a new skill, a moved file), guard the copy with `existsSync` so older engines still work.

## Releasing

```bash
npm version minor   # or patch
npm publish
git push --follow-tags
```

Move the "Unreleased" section of `CHANGELOG.md` under the new version first.

## Security

See [SECURITY.md](./SECURITY.md).
