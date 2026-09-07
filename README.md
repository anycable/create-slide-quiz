# create-slide-quiz

[![npm version](https://img.shields.io/npm/v/create-slide-quiz)](https://www.npmjs.com/package/create-slide-quiz)

Scaffold a [Reveal.js](https://revealjs.com) or [Slidev](https://sli.dev) presentation with live audience quizzes, powered by [slide-quiz](https://github.com/anycable/slide-quiz) and [AnyCable](https://anycable.io).

## Usage

```bash
npx create-slide-quiz
```

Run this inside your existing Reveal.js or Slidev project directory.

## What it does

The CLI auto-detects your framework (Reveal.js or Slidev) and walks you through the setup:

1. **AnyCable Plus** — guides you through creating a free [AnyCable Plus](https://plus.anycable.io) app (up to 2,000 concurrent connections)
2. **Install** — adds [`slide-quiz`](https://www.npmjs.com/package/slide-quiz) (for Reveal.js) or [`slidev-addon-slide-quiz`](https://www.npmjs.com/package/slidev-addon-slide-quiz) (for Slidev)
3. **Configure** — injects plugin config and sample quiz slides into your deck
4. **Serverless functions** — copies the answer/sync functions for Netlify or Vercel
5. **Deploy** — optionally deploys via Netlify or Vercel CLI

### Reveal.js

For Reveal.js projects, the CLI:
- Detects your HTML file and JS entry point
- Adds `slide-quiz` imports and plugin config
- Creates `quiz.html` and `quiz.js` (the audience voting page)
- Inserts sample quiz slides into your deck

### Slidev

For Slidev projects, the CLI:
- Adds `slidev-addon-slide-quiz` to your dependencies
- Configures `slides.md` frontmatter with the addon and WebSocket settings
- Copies `quiz.html` to your `public/` directory
- Appends sample quiz slides using the `quiz` and `quiz-results` layouts

## Non-interactive use (CI, AI agents)

Every prompt has a flag. With `--yes` and both AnyCable URLs the CLI runs to completion without input:

```bash
npx create-slide-quiz --yes --platform vercel --no-deploy \
  --ws-url wss://my-cable.fly.dev/cable \
  --broadcast-url https://my-cable.fly.dev/_broadcast
```

| Flag | Meaning |
|---|---|
| `--platform <netlify\|vercel>` | Deploy target. Default: detected from `netlify.toml` / `vercel.json`, else Netlify |
| `--framework <slidev\|revealjs>` | Only needed when auto-detection fails |
| `--ws-url`, `--broadcast-url` | AnyCable URLs. The broadcast URL goes to `.env` and the host, never into code |
| `--no-deploy` | Skip the deploy step |
| `--skills` / `--no-skills` | Copy the slide-quiz agent skills into `.claude/skills/`. Default: ask; `--yes` implies yes |
| `-y`, `--yes` | Skip the review prompt, accept defaults, and skip the deploy step (it prints the deploy command instead) |

`npx create-slide-quiz --help` lists them.

## Verifying a deploy

The package also ships `verify-slide-quiz`, which checks a deployed site without a browser: the audience page is served, both serverless functions answer, and a POST to each one produces a broadcast that arrives back over the AnyCable WebSocket.

```bash
npx -p create-slide-quiz verify-slide-quiz --site https://my-talk.vercel.app --platform vercel \
  --ws-url wss://my-cable.fly.dev/cable
```

Each failure prints the likely cause (functions missing, `ANYCABLE_BROADCAST_URL` unset, cable has a secret set, and so on). Needs Node 22 for the WebSocket part; without `--ws-url` it runs the HTTP checks only.

## Requirements

- Node.js 18+ (Node 22 for `verify-slide-quiz`)
- An existing Reveal.js or Slidev project (or the CLI will help you set one up)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) or [Vercel CLI](https://vercel.com/docs/cli) for deployment (optional)

## Contributing

Bugs in the scaffolding go in this repo's [issues](https://github.com/anycable/create-slide-quiz/issues/new?template=bug_report.yml). Problems with the running quiz (audience cannot join, votes do not appear) belong to [slide-quiz](https://github.com/anycable/slide-quiz/issues/new?template=bug_report.yml). See [CONTRIBUTING.md](./CONTRIBUTING.md) for how the repo works and how to test against a real deck.

## License

MIT
