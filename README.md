# create-slide-quiz

[![npm version](https://img.shields.io/npm/v/create-slide-quiz)](https://www.npmjs.com/package/create-slide-quiz)

Scaffold a [Reveal.js](https://revealjs.com) or [Slidev](https://sli.dev) presentation with live audience quizzes, powered by [slide-quiz](https://github.com/anycable/slide-quiz) and [AnyCable](https://anycable.io).

## Usage

```bash
npx create-slide-quiz
```

Run this inside your existing presentation directory, or in an empty directory to start from scratch.

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

## Requirements

- Node.js 18+
- An existing Reveal.js or Slidev project (or the CLI will help you set one up)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/) or [Vercel CLI](https://vercel.com/docs/cli) for deployment (optional)

## License

MIT
