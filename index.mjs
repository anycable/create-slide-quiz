#!/usr/bin/env node

/**
 * create-live-quiz — Interactive scaffolder for live-quiz
 *
 * Usage: npx create-live-quiz
 */

import * as p from "@clack/prompts";
import { execSync, exec } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:process";
import color from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──

function openUrl(url) {
  const cmd =
    platform === "darwin" ? "open" :
    platform === "win32" ? "start" :
    "xdg-open";
  exec(`${cmd} ${url}`);
}

function hasCommand(name) {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── Main ──

async function main() {
  console.clear();

  p.intro(color.bgCyan(color.black(" create-live-quiz ")));

  p.note(
    [
      "This will walk you through setting up a Reveal.js",
      "presentation with live audience quizzes.",
      "",
      `Powered by ${color.cyan("AnyCable")} + ${color.cyan("live-quiz")}`,
    ].join("\n"),
    "Welcome",
  );

  // ═══════════════════════════════════════════
  // Step 1: AnyCable Plus
  // ═══════════════════════════════════════════

  const setupAnyCable = await p.confirm({
    message: "Do you already have an AnyCable Plus app set up?",
    initialValue: false,
  });
  if (p.isCancel(setupAnyCable)) return p.cancel("Cancelled.");

  if (!setupAnyCable) {
    p.log.step(color.bold("Let's create your AnyCable Plus app"));

    openUrl("https://plus.anycable.io");
    p.log.info(`Opened ${color.underline("plus.anycable.io")} — sign in with GitHub`);

    await p.confirm({
      message: "Signed in? Let's continue.",
      active: "Continue",
      inactive: "Waiting...",
    });

    p.note(
      [
        `1. Click ${color.bold("New Cable")}`,
        `2. Name it anything (e.g. ${color.cyan("revealjs-cable")})`,
        `3. Under ${color.bold("Your backend")}, pick ${color.bold("JavaScript")}`,
        `4. Click ${color.bold("Next")}`,
      ].join("\n"),
      "Create a new cable",
    );

    await p.confirm({
      message: "Created? Next step.",
      active: "Continue",
      inactive: "Waiting...",
    });

    p.note(
      [
        `You'll see an ${color.bold("Application secret")} screen.`,
        "",
        `→ ${color.bold("Clear the secret")} (empty the input field)`,
        `→ This switches AnyCable into ${color.italic("public streams")} mode`,
        `→ Click ${color.bold("Next")} and wait for deploy`,
      ].join("\n"),
      "Enable public streams",
    );

    await p.confirm({
      message: "Cable deployed?",
      active: "Continue",
      inactive: "Waiting...",
    });

    p.log.success("AnyCable app is ready!");
  }

  // Get URLs
  const urls = await p.group(
    {
      wsUrl: () =>
        p.text({
          message: "WebSocket URL",
          placeholder: "wss://your-cable.anycable.io/cable",
          validate: (v) =>
            v.startsWith("wss://") ? undefined : 'Should start with "wss://"',
        }),
      broadcastUrl: () =>
        p.text({
          message: "Broadcast URL",
          placeholder: "https://your-cable.anycable.io/_broadcast",
          validate: (v) =>
            v.startsWith("https://") ? undefined : 'Should start with "https://"',
        }),
      broadcastKey: () =>
        p.text({
          message: "Broadcast key (may be empty)",
          placeholder: "leave empty if none",
          defaultValue: "",
        }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    },
  );

  // ═══════════════════════════════════════════
  // Step 2: Project config
  // ═══════════════════════════════════════════

  const config = await p.group(
    {
      projectName: () =>
        p.text({
          message: "Project folder name",
          placeholder: "my-quiz-deck",
          defaultValue: "my-quiz-deck",
        }),
      quizGroupId: () =>
        p.text({
          message: "Quiz group ID (unique per talk)",
          placeholder: "my-talk",
          defaultValue: "my-talk",
        }),
      platform: () =>
        p.select({
          message: "Deploy platform",
          options: [
            { value: "netlify", label: "Netlify", hint: "recommended" },
            { value: "vercel", label: "Vercel" },
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    },
  );

  const projectDir = resolve(process.cwd(), config.projectName);

  if (existsSync(projectDir)) {
    const overwrite = await p.confirm({
      message: `${config.projectName}/ already exists. Continue?`,
      initialValue: false,
    });
    if (!overwrite || p.isCancel(overwrite)) return p.cancel("Cancelled.");
  }

  // ═══════════════════════════════════════════
  // Step 3: Scaffold
  // ═══════════════════════════════════════════

  const s = p.spinner();
  s.start("Scaffolding project...");

  mkdirSync(projectDir, { recursive: true });

  // package.json
  const pkg = {
    name: config.projectName,
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
    dependencies: {
      "reveal.js": "^5.2.1",
      "live-quiz": "^0.1.0",
      vite: "^6.0.0",
    },
  };
  writeFileSync(join(projectDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

  // vite.config.js
  writeFileSync(
    join(projectDir, "vite.config.js"),
    `import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        quiz: resolve(import.meta.dirname, "quiz.html"),
      },
    },
  },
});
`,
  );

  const endpointsJs =
    config.platform === "vercel"
      ? '\n    endpoints: { answer: "/api/quiz-answer", sync: "/api/quiz-sync" },'
      : "";

  // main.js
  writeFileSync(
    join(projectDir, "main.js"),
    `import Reveal from "reveal.js";
import RevealLiveQuiz from "live-quiz";
import "live-quiz/style.css";

const deck = new Reveal({
  plugins: [RevealLiveQuiz],
  liveQuiz: {
    wsUrl: "${urls.wsUrl}",
    quizGroupId: "${config.quizGroupId}",
    quizUrl: \`\${window.location.origin}/quiz.html\`,${endpointsJs}
  },
  hash: true,
});

deck.initialize();
`,
  );

  // index.html
  writeFileSync(
    join(projectDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Quiz Deck</title>
    <link rel="stylesheet" href="node_modules/reveal.js/dist/reveal.css" />
    <link rel="stylesheet" href="node_modules/reveal.js/dist/theme/black.css" />
  </head>
  <body>
    <div class="reveal">
      <div class="slides">

        <section>
          <h1>My Presentation</h1>
          <p>With live audience quizzes!</p>
        </section>

        <!-- Quiz question — edit this! -->
        <section data-quiz-id="q1"
                 data-quiz-question="What's your favorite color?"
                 data-quiz-options='[
                   {"label":"A","text":"Red"},
                   {"label":"B","text":"Blue","correct":true},
                   {"label":"C","text":"Green"},
                   {"label":"D","text":"Yellow"}
                 ]'>
        </section>

        <!-- Results slide -->
        <section data-quiz-results="q1"
                 data-quiz-question="What's your favorite color?"
                 data-quiz-options='[
                   {"label":"A","text":"Red"},
                   {"label":"B","text":"Blue","correct":true},
                   {"label":"C","text":"Green"},
                   {"label":"D","text":"Yellow"}
                 ]'>
        </section>

        <section>
          <h2>Thanks!</h2>
        </section>

      </div>
    </div>
    <script type="module" src="/main.js"></script>
  </body>
</html>
`,
  );

  // quiz.html
  writeFileSync(
    join(projectDir, "quiz.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quiz — Join</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; }
    </style>
  </head>
  <body>
    <div id="quiz-root"></div>
    <script type="module" src="/quiz.js"></script>
  </body>
</html>
`,
  );

  // quiz.js
  writeFileSync(
    join(projectDir, "quiz.js"),
    `import { createParticipantUI } from "live-quiz/participant";
import "live-quiz/participant.css";

createParticipantUI("#quiz-root", {
  wsUrl: "${urls.wsUrl}",
  quizGroupId: "${config.quizGroupId}",${endpointsJs}
  questions: [
    {
      quizId: "q1",
      question: "What's your favorite color?",
      options: [
        { label: "A", text: "Red" },
        { label: "B", text: "Blue" },
        { label: "C", text: "Green" },
        { label: "D", text: "Yellow" },
      ],
    },
  ],
});
`,
  );

  // .gitignore
  writeFileSync(
    join(projectDir, ".gitignore"),
    "node_modules\ndist\n.netlify\n.vercel\n.env\n",
  );

  // .env
  writeFileSync(
    join(projectDir, ".env"),
    `ANYCABLE_BROADCAST_URL=${urls.broadcastUrl}\nANYCABLE_BROADCAST_KEY=${urls.broadcastKey}\n`,
  );

  // Serverless functions
  const functionsSourceDir = join(__dirname, "functions");

  if (config.platform === "netlify") {
    const netlifyFnDir = join(projectDir, "netlify", "functions");
    mkdirSync(netlifyFnDir, { recursive: true });
    for (const f of ["quiz-answer.mts", "quiz-sync.mts", "shared.mts", "package.json"]) {
      copyFileSync(join(functionsSourceDir, "netlify", f), join(netlifyFnDir, f));
    }

    writeFileSync(
      join(projectDir, "netlify.toml"),
      `[build]\n  command = "npm run build"\n  publish = "dist"\n  functions = "netlify/functions"\n\n[build.environment]\n  NODE_VERSION = "22"\n`,
    );
  } else {
    const apiDir = join(projectDir, "api");
    mkdirSync(apiDir, { recursive: true });
    for (const f of ["quiz-answer.ts", "quiz-sync.ts", "shared.ts", "package.json"]) {
      copyFileSync(join(functionsSourceDir, "vercel", f), join(apiDir, f));
    }
  }

  s.stop("Project scaffolded!");

  // ═══════════════════════════════════════════
  // Step 4: Install dependencies
  // ═══════════════════════════════════════════

  s.start("Installing dependencies...");
  try {
    execSync("npm install", { cwd: projectDir, stdio: "pipe" });
    s.stop("Dependencies installed!");
  } catch {
    s.stop("npm install failed — run it manually.");
  }

  // Git init
  if (!existsSync(join(projectDir, ".git"))) {
    try {
      execSync('git init && git add -A && git commit -m "Initial commit from create-live-quiz"', {
        cwd: projectDir,
        stdio: "pipe",
      });
      p.log.success("Git repo initialized.");
    } catch {
      // skip
    }
  }

  // ═══════════════════════════════════════════
  // Step 5: Platform deploy
  // ═══════════════════════════════════════════

  if (config.platform === "netlify") {
    const hasNetlify = hasCommand("netlify");

    if (hasNetlify) {
      const useNetlifyCli = await p.confirm({
        message: "Netlify CLI detected. Link and deploy now?",
        initialValue: true,
      });

      if (useNetlifyCli && !p.isCancel(useNetlifyCli)) {
        p.log.step("Running `netlify init`...");
        try {
          run("netlify init", projectDir);
        } catch {
          p.log.warn("netlify init failed — you can run it later.");
        }

        s.start("Setting environment variables...");
        try {
          execSync(`netlify env:set ANYCABLE_BROADCAST_URL "${urls.broadcastUrl}"`, {
            cwd: projectDir,
            stdio: "pipe",
          });
          if (urls.broadcastKey) {
            execSync(`netlify env:set ANYCABLE_BROADCAST_KEY "${urls.broadcastKey}"`, {
              cwd: projectDir,
              stdio: "pipe",
            });
          }
          s.stop("Environment variables set on Netlify!");
        } catch {
          s.stop("Could not set env vars — set them in the Netlify dashboard.");
        }

        const deploy = await p.confirm({
          message: "Build and deploy to production?",
          initialValue: true,
        });

        if (deploy && !p.isCancel(deploy)) {
          s.start("Building and deploying...");
          try {
            execSync("npm run build && netlify deploy --prod --dir=dist", {
              cwd: projectDir,
              stdio: "pipe",
            });
            s.stop("Deployed to Netlify!");
          } catch {
            s.stop("Deploy failed — try `npm run build && netlify deploy --prod --dir=dist` manually.");
          }
        }
      }
    } else {
      p.log.info("Opening Netlify to create a new site...");
      openUrl("https://app.netlify.com/start");

      p.note(
        [
          "1. Import your Git repo",
          "2. Build command: npm run build",
          "3. Publish directory: dist",
          "4. Add env vars in Site settings → Environment variables:",
          `   ANYCABLE_BROADCAST_URL = ${urls.broadcastUrl}`,
          urls.broadcastKey ? `   ANYCABLE_BROADCAST_KEY = ${urls.broadcastKey}` : "",
          "",
          `Or install the CLI: ${color.cyan("npm i -g netlify-cli")}`,
        ]
          .filter(Boolean)
          .join("\n"),
        "Deploy to Netlify",
      );
    }
  } else {
    // Vercel
    const hasVercel = hasCommand("vercel");

    if (hasVercel) {
      const useVercelCli = await p.confirm({
        message: "Vercel CLI detected. Link and deploy now?",
        initialValue: true,
      });

      if (useVercelCli && !p.isCancel(useVercelCli)) {
        p.log.step("Running `vercel link`...");
        try {
          run("vercel link", projectDir);
        } catch {
          p.log.warn("vercel link failed — you can run it later.");
        }

        s.start("Setting environment variables...");
        try {
          execSync(
            `echo "${urls.broadcastUrl}" | vercel env add ANYCABLE_BROADCAST_URL production`,
            { cwd: projectDir, stdio: "pipe" },
          );
          if (urls.broadcastKey) {
            execSync(
              `echo "${urls.broadcastKey}" | vercel env add ANYCABLE_BROADCAST_KEY production`,
              { cwd: projectDir, stdio: "pipe" },
            );
          }
          s.stop("Environment variables set on Vercel!");
        } catch {
          s.stop("Could not set env vars — set them in the Vercel dashboard.");
        }

        const deploy = await p.confirm({
          message: "Deploy to production?",
          initialValue: true,
        });

        if (deploy && !p.isCancel(deploy)) {
          s.start("Deploying...");
          try {
            execSync("vercel --prod", { cwd: projectDir, stdio: "pipe" });
            s.stop("Deployed to Vercel!");
          } catch {
            s.stop("Deploy failed — try `vercel --prod` manually.");
          }
        }
      }
    } else {
      p.log.info("Opening Vercel to create a new project...");
      openUrl("https://vercel.com/new");

      p.note(
        [
          "1. Import your Git repo",
          "2. Framework preset: Vite",
          "3. Add env vars in Settings → Environment Variables:",
          `   ANYCABLE_BROADCAST_URL = ${urls.broadcastUrl}`,
          urls.broadcastKey ? `   ANYCABLE_BROADCAST_KEY = ${urls.broadcastKey}` : "",
          "",
          `Or install the CLI: ${color.cyan("npm i -g vercel")}`,
        ]
          .filter(Boolean)
          .join("\n"),
        "Deploy to Vercel",
      );
    }
  }

  // ═══════════════════════════════════════════
  // Done
  // ═══════════════════════════════════════════

  const nextSteps = [
    `cd ${config.projectName}`,
    "npm run dev",
    "",
    `Edit quiz slides in ${color.bold("index.html")}`,
    `Edit participant questions in ${color.bold("quiz.js")}`,
  ].join("\n");

  p.note(nextSteps, "Next steps");

  p.outro(color.green("Happy quizzing! 🎯"));
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
