import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createTestDir } from "./helpers.mjs";
import { insertQuizSlides, modifySlidesConfig, ensureGitignore } from "../lib.mjs";

let cleanup;
afterEach(async () => { if (cleanup) await cleanup(); });

describe("insertQuizSlides", () => {
  let dir;

  it("inserts quiz HTML before closing .slides div", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    const result = insertQuizSlides(dir, "index.html");
    expect(result).toBe(true);

    const html = readFileSync(join(dir, "index.html"), "utf-8");
    expect(html).toContain('data-quiz-results="q1"');
    // Quiz slides should appear before the closing </div> of .slides
    const quizIdx = html.indexOf("data-quiz-results");
    const closingSlidesIdx = html.indexOf("</div>", quizIdx);
    expect(closingSlidesIdx).toBeGreaterThan(quizIdx);
  });

  it("returns false when no .slides div found", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "test.html"), '<div class="reveal"><p>No slides div</p></div>');
    const result = insertQuizSlides(dir, "test.html");
    expect(result).toBe(false);
  });
});

describe("modifySlidesConfig", () => {
  let dir;

  it("adds addons + slideQuiz to existing frontmatter", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    modifySlidesConfig(dir, "wss://test.anycable.io/cable", "my-quiz", false);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("addons:");
    expect(content).toContain("slidev-addon-slide-quiz");
    expect(content).toContain("slideQuiz:");
    expect(content).toContain("wss://test.anycable.io/cable");
    expect(content).toContain("my-quiz");
    expect(content).toContain("quizUrl: /quiz.html");
  });

  it("skips addons if already present", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "slides.md"), "---\ntheme: default\naddons:\n  - some-addon\n---\n\n# Hello\n");
    modifySlidesConfig(dir, "wss://test.anycable.io/cable", "my-quiz", false);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    // Should still have the original addons line, not duplicate
    const addonMatches = content.match(/addons:/g);
    expect(addonMatches).toHaveLength(1);
    // But slideQuiz should be added
    expect(content).toContain("slideQuiz:");
  });

  it("creates frontmatter when file has none", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "slides.md"), "# My Presentation\n\nSome content\n");
    modifySlidesConfig(dir, "wss://test.anycable.io/cable", "my-quiz", false);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("addons:");
    expect(content).toContain("slideQuiz:");
    expect(content).toContain("# My Presentation");
  });

  it("includes Vercel endpoints when isVercel=true", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    modifySlidesConfig(dir, "wss://test.anycable.io/cable", "my-quiz", true);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("endpoints:");
    expect(content).toContain("answer: /api/quiz-answer");
    expect(content).toContain("sync: /api/quiz-sync");
  });

  it("does not include endpoints when isVercel=false", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    modifySlidesConfig(dir, "wss://test.anycable.io/cable", "my-quiz", false);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).not.toContain("endpoints:");
  });
});

describe("ensureGitignore", () => {
  let dir;

  it("creates .gitignore if none exists", async () => {
    ({ dir, cleanup } = await createTestDir());
    ensureGitignore(dir, "node_modules");

    const content = readFileSync(join(dir, ".gitignore"), "utf-8");
    expect(content).toBe("node_modules\n");
  });

  it("appends entry to existing file", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, ".gitignore"), "dist\n");
    ensureGitignore(dir, "node_modules");

    const content = readFileSync(join(dir, ".gitignore"), "utf-8");
    expect(content).toContain("dist");
    expect(content).toContain("node_modules");
  });

  it("does not duplicate existing entry", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, ".gitignore"), "node_modules\n");
    ensureGitignore(dir, "node_modules");

    const content = readFileSync(join(dir, ".gitignore"), "utf-8");
    const matches = content.match(/node_modules/g);
    expect(matches).toHaveLength(1);
  });
});
