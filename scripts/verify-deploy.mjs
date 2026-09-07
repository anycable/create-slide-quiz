#!/usr/bin/env node
/**
 * verify-slide-quiz — check a deployed slide-quiz site end to end, without a browser.
 *
 *   npx verify-slide-quiz --site https://my-talk.vercel.app --platform vercel \
 *     --ws-url wss://my-cable.fly.dev/cable
 *
 * What it checks, in order:
 *   1. The audience page is served (GET quizUrl → 200, HTML)
 *   2. Both serverless functions exist (GET → 405 JSON, which is how they answer non-POST)
 *   3. With --ws-url: subscribe to the quiz streams over WebSocket, POST to each
 *      function, and confirm the broadcast comes back. This proves
 *      ANYCABLE_BROADCAST_URL is set correctly on the host.
 *
 * Exit code 0 when every check passes, 1 otherwise. Needs Node 22+ (native WebSocket).
 */
import { createCable } from "@anycable/core";

const ENDPOINTS = {
  netlify: { answer: "/.netlify/functions/quiz-answer", sync: "/.netlify/functions/quiz-sync" },
  vercel: { answer: "/api/quiz-answer", sync: "/api/quiz-sync" },
};

function parse(argv) {
  const o = { platform: "netlify", quizUrl: "/quiz.html", timeout: 15_000 };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].includes("=") ? argv[i].split(/=(.*)/s) : [argv[i], undefined];
    const val = () => inline ?? argv[++i];
    switch (flag) {
      case "--site": o.site = val(); break;
      case "--platform": o.platform = val(); break;
      case "--ws-url": o.wsUrl = val(); break;
      case "--quiz-url": o.quizUrl = val(); break;
      case "--quiz-group-id": o.quizGroupId = val(); break;
      case "--answer-endpoint": o.answer = val(); break;
      case "--sync-endpoint": o.sync = val(); break;
      case "--timeout": o.timeout = Number(val()); break;
      case "-h": case "--help": o.help = true; break;
      default: throw new Error(`Unknown option "${flag}"`);
    }
  }
  if (o.help) return o;
  if (!o.site) throw new Error("--site is required (e.g. https://my-talk.netlify.app)");
  if (!ENDPOINTS[o.platform]) throw new Error("--platform must be netlify or vercel");
  o.answer ??= ENDPOINTS[o.platform].answer;
  o.sync ??= ENDPOINTS[o.platform].sync;
  o.quizGroupId ??= `verify-${Date.now().toString(36)}`;
  o.site = o.site.replace(/\/$/, "");
  return o;
}

const results = [];
function pass(name, detail = "") { results.push({ ok: true, name, detail }); console.log(`  ok   ${name}${detail ? `  (${detail})` : ""}`); }
function fail(name, detail) { results.push({ ok: false, name, detail }); console.log(`  FAIL ${name}\n       ${detail}`); }

async function checkPage(o) {
  const url = o.site + o.quizUrl;
  try {
    const res = await fetch(url);
    const body = await res.text();
    if (res.ok && /<html/i.test(body)) pass("audience page served", url);
    else fail("audience page served", `${url} returned ${res.status}${/<html/i.test(body) ? "" : " and no HTML"}. For Slidev, the addon's page is at /theme/quiz.html unless it was copied into public/.`);
  } catch (e) {
    fail("audience page served", `${url}: ${e.message}`);
  }
}

async function checkFunctionExists(o, name, path) {
  const url = o.site + path;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (res.status === 405 && /Method not allowed/i.test(text)) return pass(`${name} function deployed`, url);
    if (res.status === 404) return fail(`${name} function deployed`, `${url} → 404. Functions are missing from the deploy (netlify/functions/ or api/), or the platform flag does not match the site.`);
    if (/<html/i.test(text)) return fail(`${name} function deployed`, `${url} → ${res.status} with an HTML page. A SPA rewrite is catching the function route.`);
    fail(`${name} function deployed`, `${url} → ${res.status}: ${text.slice(0, 120)}`);
  } catch (e) {
    fail(`${name} function deployed`, `${url}: ${e.message}`);
  }
}

function waitForMessage(channel, predicate, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { off(); resolve(null); }, ms);
    const off = channel.on("message", (msg) => {
      if (predicate(msg)) { clearTimeout(timer); off(); resolve(msg); }
    });
  });
}

async function checkBroadcasts(o) {
  if (typeof WebSocket !== "function") {
    return fail("websocket round trip", "Node 22+ is needed for the WebSocket checks (native WebSocket).");
  }
  const cable = createCable(o.wsUrl, { protocol: "actioncable-v1-ext-json", logLevel: "error" });
  try {
    await Promise.race([
      cable.connect(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("connect timed out")), o.timeout)),
    ]);
    pass("websocket connected", o.wsUrl);
  } catch (e) {
    return fail("websocket connected", `${o.wsUrl}: ${e.message}. Check the URL ends with /cable and the cable is running.`);
  }

  const sync = cable.streamFrom(`quiz:${o.quizGroupId}:sync`);
  const answers = cable.streamFrom(`quiz:${o.quizGroupId}:results`);
  try {
    await Promise.race([
      Promise.all([sync.ensureSubscribed(), answers.ensureSubscribed()]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("subscribe timed out")), o.timeout)),
    ]);
    pass("subscribed to public streams", `quiz:${o.quizGroupId}:*`);
  } catch (e) {
    cable.disconnect();
    return fail("subscribed to public streams", `${e.message}. "unauthorized" or "rejected" means the cable has an application secret set; slide-quiz needs public streams mode.`);
  }

  const sessionId = `verify-${Math.random().toString(36).slice(2)}`;

  // Sync: presenter → audience
  const syncArrived = waitForMessage(sync, (m) => m?.sessionId === sessionId, o.timeout);
  const syncRes = await fetch(o.site + o.sync, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeQuestionId: null, sessionId, quizGroupId: o.quizGroupId, results: {} }),
  });
  const syncText = await syncRes.text();
  if (syncRes.ok) pass("sync function accepts POST", `${syncRes.status} ${syncText.trim()}`);
  else fail("sync function accepts POST", `${syncRes.status} ${syncText.slice(0, 160)}${syncRes.status === 502 ? " → ANYCABLE_BROADCAST_URL is wrong or unset on the host, or the cable is down." : ""}`);
  if (await syncArrived) pass("sync broadcast received over websocket");
  else fail("sync broadcast received over websocket", `Nothing arrived on quiz:${o.quizGroupId}:sync within ${o.timeout / 1000}s. The function returned ${syncRes.status}; if that was 200, ANYCABLE_BROADCAST_URL points at a different cable than --ws-url.`);

  // Answer: audience → presenter
  const answerArrived = waitForMessage(answers, (m) => m?.sessionId === sessionId, o.timeout);
  const ansRes = await fetch(o.site + o.answer, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quizId: "verify", answer: "A", sessionId, quizGroupId: o.quizGroupId }),
  });
  const ansText = await ansRes.text();
  if (ansRes.ok) pass("answer function accepts POST", `${ansRes.status} ${ansText.trim()}`);
  else fail("answer function accepts POST", `${ansRes.status} ${ansText.slice(0, 160)}`);
  if (await answerArrived) pass("answer broadcast received over websocket");
  else fail("answer broadcast received over websocket", `Nothing arrived on quiz:${o.quizGroupId}:results within ${o.timeout / 1000}s.`);

  cable.disconnect();
}

async function main() {
  let o;
  try {
    o = parse(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (o.help) {
    console.log(`verify-slide-quiz --site <url> [--platform netlify|vercel] [--ws-url wss://...]
                  [--quiz-url /quiz.html] [--quiz-group-id id] [--answer-endpoint p] [--sync-endpoint p] [--timeout ms]`);
    return;
  }
  console.log(`Verifying ${o.site} (${o.platform})`);
  await checkPage(o);
  await checkFunctionExists(o, "sync", o.sync);
  await checkFunctionExists(o, "answer", o.answer);
  if (o.wsUrl) await checkBroadcasts(o);
  else console.log("  skip websocket round trip (pass --ws-url to test broadcasting)");

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} check(s) failed.` : "\nAll checks passed.");
  process.exit(failed.length ? 1 : 0);
}

main();
