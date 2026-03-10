import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Create a temp directory pre-populated with fixture files.
 *
 * @param {object} options
 * @param {"revealjs"|"slidev"|"empty"} [options.framework="empty"]
 * @param {"netlify"|"vercel"|null} [options.platform=null]
 * @returns {Promise<{dir: string, cleanup: () => Promise<void>}>}
 */
export async function createTestDir(options = {}) {
  const { framework = "empty", platform = null } = options;
  const dir = await mkdtemp(join(tmpdir(), "create-slide-quiz-test-"));

  if (framework === "revealjs") {
    writeFileSync(
      join(dir, "index.html"),
      `<!doctype html>
<html>
  <head><title>Test</title></head>
  <body>
    <div class="reveal">
      <div class="slides">
        <section>Slide 1</section>
      </div>
    </div>
  </body>
</html>
`,
    );

    writeFileSync(
      join(dir, "main.js"),
      `import Reveal from "reveal.js";

Reveal.initialize({
  hash: true,
});
`,
    );

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-reveal-project",
        dependencies: { "reveal.js": "^5.0.0" },
      }, null, 2),
    );
  }

  if (framework === "slidev") {
    writeFileSync(
      join(dir, "slides.md"),
      `---
theme: default
---

# Welcome

Hello world
`,
    );

    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-slidev-project",
        dependencies: { "@slidev/cli": "^0.50.0" },
      }, null, 2),
    );
  }

  if (platform === "netlify") {
    writeFileSync(join(dir, "netlify.toml"), "[build]\n  command = \"npm run build\"\n");
  }
  if (platform === "vercel") {
    writeFileSync(join(dir, "vercel.json"), "{}");
  }

  // Mock node_modules with stub files for both packages
  const lqFunctionsNetlify = join(dir, "node_modules", "slide-quiz", "functions", "netlify");
  const lqFunctionsVercel = join(dir, "node_modules", "slide-quiz", "functions", "vercel");
  mkdirSync(lqFunctionsNetlify, { recursive: true });
  mkdirSync(lqFunctionsVercel, { recursive: true });
  writeFileSync(join(lqFunctionsNetlify, "quiz-answer.mjs"), "// stub");
  writeFileSync(join(lqFunctionsNetlify, "quiz-sync.mjs"), "// stub");
  writeFileSync(join(lqFunctionsVercel, "quiz-answer.mjs"), "// stub");
  writeFileSync(join(lqFunctionsVercel, "quiz-sync.mjs"), "// stub");

  const addonPublic = join(dir, "node_modules", "slidev-addon-slide-quiz", "public");
  mkdirSync(addonPublic, { recursive: true });
  writeFileSync(join(addonPublic, "quiz.html"), "<!doctype html><html><body>quiz</body></html>");
  writeFileSync(join(addonPublic, "_redirects"), "/api/* /.netlify/functions/:splat 200");

  const cleanup = () => rm(dir, { recursive: true, force: true });
  return { dir, cleanup };
}
