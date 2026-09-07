import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createTestDir } from "./helpers.mjs";

// Mock @clack/prompts before importing lib
vi.mock("@clack/prompts", () => {
  const spinner = () => ({ start: vi.fn(), stop: vi.fn() });
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    spinner,
    log: { info: vi.fn(), success: vi.fn(), error: vi.fn(), step: vi.fn(), warn: vi.fn() },
    note: vi.fn(),
    cancel: vi.fn(),
    isCancel: vi.fn(() => false),
    select: vi.fn(),
    confirm: vi.fn(),
    text: vi.fn(),
    group: vi.fn(),
  };
});

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("picocolors", () => ({
  default: {
    bgCyan: (s) => s,
    black: (s) => s,
    green: (s) => s,
    red: (s) => s,
    yellow: (s) => s,
    cyan: (s) => s,
    dim: (s) => s,
    bold: (s) => s,
    italic: (s) => s,
    underline: (s) => s,
  },
}));

const p = await import("@clack/prompts");
const { main } = await import("../lib.mjs");

let cleanup;
let dir;

afterEach(async () => {
  vi.restoreAllMocks();
  if (cleanup) await cleanup();
});

/**
 * Configure mocks for a complete flow.
 * Simulates: platform select → AnyCable confirm (yes) → URL group → review confirm
 */
function setupFlowMocks({ platform = "netlify", wsUrl = "wss://test.anycable.io/cable", broadcastUrl = "https://test.anycable.io/_broadcast" } = {}) {
  // confirm: "Do you already have an AnyCable Plus app set up?" → true (skip setup)
  p.confirm.mockResolvedValue(true);

  // select calls in order: platform (if needed), then review confirm
  const selectResponses = [];
  selectResponses.push(platform);  // platform select
  selectResponses.push("confirm"); // review "Look good?" → confirm

  let selectIdx = 0;
  p.select.mockImplementation(() => {
    return Promise.resolve(selectResponses[selectIdx++]);
  });

  // group: AnyCable URLs
  p.group.mockResolvedValue({ wsUrl, broadcastUrl });
}

describe("Slidev + Netlify flow", () => {
  beforeEach(async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    setupFlowMocks({ platform: "netlify" });
  });

  it("detects Slidev, copies quiz.html to public/", async () => {
    await main();
    expect(existsSync(join(dir, "public", "quiz.html"))).toBe(true);
  });

  it("writes a SPA _redirects to public/ for Netlify", async () => {
    await main();
    expect(readFileSync(join(dir, "public", "_redirects"), "utf-8")).toBe("/*  /index.html  200\n");
  });

  it("copies agent skills into .claude/skills/ when confirmed", async () => {
    await main();
    expect(existsSync(join(dir, ".claude", "skills", "slide-quiz-setup", "SKILL.md"))).toBe(true);
    expect(existsSync(join(dir, ".claude", "skills", "slide-quiz-debug", "SKILL.md"))).toBe(true);
  });

  it("skips agent skills with skills: false", async () => {
    await main({ skills: false });
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  it("copies functions to netlify/functions/", async () => {
    await main();
    expect(existsSync(join(dir, "netlify", "functions", "quiz-answer.mjs"))).toBe(true);
    expect(existsSync(join(dir, "netlify", "functions", "quiz-sync.mjs"))).toBe(true);
  });

  it("modifies slides.md headmatter (addons + slideQuiz)", async () => {
    await main();
    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("addons:");
    expect(content).toContain("slidev-addon-slide-quiz");
    expect(content).toContain("slideQuiz:");
    expect(content).toContain("wss://test.anycable.io/cable");
  });

  it("appends sample quiz slides to slides.md", async () => {
    await main();
    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("layout: quiz-results");
  });

  it("creates netlify.toml with 'npx slidev build'", async () => {
    await main();
    const content = readFileSync(join(dir, "netlify.toml"), "utf-8");
    expect(content).toContain("npx slidev build");
  });

  it("creates .env with broadcast URL", async () => {
    await main();
    const content = readFileSync(join(dir, ".env"), "utf-8");
    expect(content).toContain("ANYCABLE_BROADCAST_URL=https://test.anycable.io/_broadcast");
  });
});

describe("Slidev + Vercel flow", () => {
  beforeEach(async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    setupFlowMocks({ platform: "vercel" });
  });

  it("copies functions to api/", async () => {
    await main();
    expect(existsSync(join(dir, "api", "quiz-answer.mjs"))).toBe(true);
    expect(existsSync(join(dir, "api", "quiz-sync.mjs"))).toBe(true);
  });

  it("includes Vercel endpoints in slides.md headmatter", async () => {
    await main();
    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("endpoints:");
    expect(content).toContain("answer: /api/quiz-answer");
  });

  it("creates vercel.json with the Slidev build command", async () => {
    await main();
    const cfg = JSON.parse(readFileSync(join(dir, "vercel.json"), "utf-8"));
    expect(cfg).toEqual({ buildCommand: "npx slidev build", outputDirectory: "dist" });
  });

  it("does not copy _redirects", async () => {
    await main();
    expect(existsSync(join(dir, "public", "_redirects"))).toBe(false);
  });
});

describe("Reveal.js + Netlify flow", () => {
  beforeEach(async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    setupFlowMocks({ platform: "netlify" });
  });

  it("creates quiz.html and quiz.js", async () => {
    await main();
    expect(existsSync(join(dir, "quiz.html"))).toBe(true);
    expect(existsSync(join(dir, "quiz.js"))).toBe(true);
  });

  it("copies functions to netlify/functions/", async () => {
    await main();
    expect(existsSync(join(dir, "netlify", "functions", "quiz-answer.mjs"))).toBe(true);
    expect(existsSync(join(dir, "netlify", "functions", "quiz-sync.mjs"))).toBe(true);
  });

  it("creates netlify.toml with 'npm run build'", async () => {
    await main();
    const content = readFileSync(join(dir, "netlify.toml"), "utf-8");
    expect(content).toContain("npm run build");
  });

  it("inserts quiz slides into HTML", async () => {
    await main();
    const content = readFileSync(join(dir, "index.html"), "utf-8");
    expect(content).toContain('data-quiz-results="q1"');
  });

  it("creates .env", async () => {
    await main();
    expect(existsSync(join(dir, ".env"))).toBe(true);
  });
});

describe("Slidev (no slides.md, user-selected)", () => {
  beforeEach(async () => {
    ({ dir, cleanup } = await createTestDir());
    // Provide package.json since execSync is mocked (npm init -y won't run)
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-empty-project" }, null, 2));
    vi.spyOn(process, "cwd").mockReturnValue(dir);

    // No auto-detection → select framework, then platform, then AnyCable, then URLs, then confirm
    p.confirm.mockResolvedValue(true);

    let selectIdx = 0;
    const selectResponses = ["slidev", "netlify", "confirm"];
    p.select.mockImplementation(() => Promise.resolve(selectResponses[selectIdx++]));

    p.group.mockResolvedValue({
      wsUrl: "wss://test.anycable.io/cable",
      broadcastUrl: "https://test.anycable.io/_broadcast",
    });
  });

  it("creates slides.md from scratch with full config", async () => {
    await main();
    expect(existsSync(join(dir, "slides.md"))).toBe(true);

    const content = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(content).toContain("addons:");
    expect(content).toContain("slidev-addon-slide-quiz");
    expect(content).toContain("slideQuiz:");
    expect(content).toContain("layout: quiz-results");
  });
});

describe("Non-interactive flow (--yes with URLs)", () => {
  const flags = {
    yes: true,
    platform: "vercel",
    wsUrl: "wss://ci.anycable.io/cable",
    broadcastUrl: "https://ci.anycable.io/_broadcast",
    deploy: false,
  };

  beforeEach(async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    // No prompt mocks on purpose: any prompt call would resolve to undefined and break the flow.
    vi.clearAllMocks();
  });

  it("completes without calling any prompt", async () => {
    await main(flags);
    expect(p.select).not.toHaveBeenCalled();
    expect(p.confirm).not.toHaveBeenCalled();
    expect(p.group).not.toHaveBeenCalled();
    expect(p.text).not.toHaveBeenCalled();
  });

  it("uses the flag values for platform and URLs", async () => {
    await main(flags);
    const slides = readFileSync(join(dir, "slides.md"), "utf-8");
    expect(slides).toContain("wsUrl: wss://ci.anycable.io/cable");
    expect(slides).toContain("answer: /api/quiz-answer");
    expect(existsSync(join(dir, "api", "quiz-sync.mjs"))).toBe(true);
    expect(readFileSync(join(dir, ".env"), "utf-8")).toContain("https://ci.anycable.io/_broadcast");
  });

  it("--yes implies agent skills", async () => {
    await main(flags);
    expect(existsSync(join(dir, ".claude", "skills", "slide-quiz-setup", "SKILL.md"))).toBe(true);
  });

  it("--yes without a detectable framework cancels with a hint", async () => {
    await cleanup();
    ({ dir, cleanup } = await createTestDir({ framework: "empty" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    await main(flags);
    expect(p.cancel).toHaveBeenCalledWith(expect.stringContaining("--framework"));
  });

  it("--framework slidev scaffolds slides.md in an empty directory", async () => {
    await cleanup();
    ({ dir, cleanup } = await createTestDir({ framework: "empty" }));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "empty-deck" }));
    await main({ ...flags, framework: "slidev" });
    expect(existsSync(join(dir, "slides.md"))).toBe(true);
    expect(readFileSync(join(dir, "slides.md"), "utf-8")).toContain("quizGroupId: empty-deck");
  });
});
