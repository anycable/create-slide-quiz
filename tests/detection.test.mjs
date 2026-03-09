import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDir } from "./helpers.mjs";
import {
  detectFramework, findRevealHtml, detectPlatform, detectVite,
} from "../lib.mjs";

let cleanup;
afterEach(async () => { if (cleanup) await cleanup(); });

describe("detectFramework", () => {
  let dir;

  it("returns 'slidev' when slides.md exists", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "slidev" }));
    expect(detectFramework(dir)).toBe("slidev");
  });

  it("returns 'revealjs' when HTML with class='reveal' exists", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    expect(detectFramework(dir)).toBe("revealjs");
  });

  it("returns 'slidev' when both exist (slides.md takes priority)", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    writeFileSync(join(dir, "slides.md"), "---\ntheme: default\n---\n");
    expect(detectFramework(dir)).toBe("slidev");
  });

  it("returns null for empty directory", async () => {
    ({ dir, cleanup } = await createTestDir());
    expect(detectFramework(dir)).toBeNull();
  });
});

describe("findRevealHtml", () => {
  let dir;

  it("finds HTML file with class='reveal'", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    expect(findRevealHtml(dir)).toBe("index.html");
  });

  it("prefers index.html over other HTML files", async () => {
    ({ dir, cleanup } = await createTestDir({ framework: "revealjs" }));
    writeFileSync(join(dir, "presentation.html"), '<div class="reveal"><div class="slides"></div></div>');
    expect(findRevealHtml(dir)).toBe("index.html");
  });

  it("returns null when no matching HTML", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "page.html"), "<html><body>No reveal here</body></html>");
    expect(findRevealHtml(dir)).toBeNull();
  });
});

describe("detectPlatform", () => {
  let dir;

  it("returns 'netlify' for netlify.toml", async () => {
    ({ dir, cleanup } = await createTestDir({ platform: "netlify" }));
    expect(detectPlatform(dir)).toBe("netlify");
  });

  it("returns 'vercel' for vercel.json", async () => {
    ({ dir, cleanup } = await createTestDir({ platform: "vercel" }));
    expect(detectPlatform(dir)).toBe("vercel");
  });

  it("returns null when neither exists", async () => {
    ({ dir, cleanup } = await createTestDir());
    expect(detectPlatform(dir)).toBeNull();
  });
});

describe("detectVite", () => {
  let dir;

  it("finds vite.config.js", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "vite.config.js"), "export default {}");
    expect(detectVite(dir)).toBe("vite.config.js");
  });

  it("finds vite.config.ts", async () => {
    ({ dir, cleanup } = await createTestDir());
    writeFileSync(join(dir, "vite.config.ts"), "export default {}");
    expect(detectVite(dir)).toBe("vite.config.ts");
  });

  it("returns null when no config", async () => {
    ({ dir, cleanup } = await createTestDir());
    expect(detectVite(dir)).toBeNull();
  });
});
