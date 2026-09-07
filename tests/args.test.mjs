import { describe, it, expect } from "vitest";
import { parseArgs } from "../lib.mjs";

describe("parseArgs", () => {
  it("returns an empty object for no arguments", () => {
    expect(parseArgs([])).toEqual({});
  });

  it("parses every flag, in both --flag value and --flag=value forms", () => {
    expect(parseArgs([
      "--yes", "--platform=vercel", "--framework", "slidev",
      "--ws-url", "wss://a/cable", "--broadcast-url=https://a/_broadcast",
      "--no-deploy", "--no-skills",
    ])).toEqual({
      yes: true, platform: "vercel", framework: "slidev",
      wsUrl: "wss://a/cable", broadcastUrl: "https://a/_broadcast",
      deploy: false, skills: false,
    });
  });

  it("accepts short aliases", () => {
    expect(parseArgs(["-h"])).toEqual({ help: true });
    expect(() => parseArgs(["-y"])).toThrow(/--ws-url and --broadcast-url/);
  });

  it("rejects unknown flags instead of falling back to prompts", () => {
    expect(() => parseArgs(["--platfrom", "vercel"])).toThrow(/Unknown option "--platfrom"/);
  });

  it("validates enum and URL values", () => {
    expect(() => parseArgs(["--platform", "heroku"])).toThrow(/netlify or vercel/);
    expect(() => parseArgs(["--framework", "keynote"])).toThrow(/slidev or revealjs/);
    expect(() => parseArgs(["--ws-url", "https://a/cable"])).toThrow(/wss:\/\//);
    expect(() => parseArgs(["--broadcast-url", "http://a"])).toThrow(/https:\/\//);
    expect(() => parseArgs(["--platform"])).toThrow(/needs a value/);
  });

  it("--yes requires both AnyCable URLs", () => {
    expect(() => parseArgs(["--yes", "--ws-url", "wss://a/cable"])).toThrow(/--broadcast-url/);
  });
});
