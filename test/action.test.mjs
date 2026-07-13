import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { crawlerWatchActionUrl, runAction } from "../action/run.mjs";

const fakeResult = {
  site: "https://example.com/",
  state: "present",
  responseStatus: 200,
  crawlers: [
    { agent: "OAI-SearchBot", allowed: true, purpose: "search discovery" },
    { agent: "GPTBot", allowed: false, purpose: "model training" },
  ],
};

const fakeEdgeResult = {
  site: "https://example.com",
  cloudflareObserved: true,
  limits: "Synthetic requests do not authenticate a provider bot.",
  crawlers: [
    { agent: "OAI-SearchBot", status: 200, state: "reachable" },
    { agent: "Claude-SearchBot", status: 403, state: "restricted" },
    { agent: "PerplexityBot", status: null, state: "unavailable" },
  ],
};

test("writes stable GitHub Action outputs and a summary", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "actablesite-action-"));
  const outputFile = path.join(directory, "output");
  const summaryFile = path.join(directory, "summary");
  try {
    const run = await runAction({
      website: "example.com",
      check: async () => fakeResult,
      checkEdge: true,
      edgeCheck: async () => fakeEdgeResult,
      outputFile,
      summaryFile,
      write: () => {},
    });
    assert.equal(run.allowedCount, 1);
    assert.equal(run.blockedCount, 1);
    assert.equal(run.restrictedCount, 1);
    const outputs = await readFile(outputFile, "utf8");
    assert.match(outputs, /blocked-count=1/);
    assert.match(outputs, /restricted-count=1/);
    assert.match(outputs, /edge-result=.*Claude-SearchBot/);
    const summary = await readFile(summaryFile, "utf8");
    assert.match(summary, /GPTBot \| Blocked/);
    assert.match(summary, /point-in-time check/);
    assert.match(summary, /\$9\/month/);
    assert.match(summary, /Synthetic homepage responses/);
    assert.match(summary, /Claude-SearchBot \| HTTP 403 \| restricted/);
    assert.match(summary, /Cloudflare response headers observed: \*\*yes\*\*/);
    assert.ok(summary.includes(crawlerWatchActionUrl));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("can fail a workflow when a checked token is blocked", async () => {
  await assert.rejects(
    runAction({
      website: "example.com",
      failOnBlocked: true,
      check: async () => fakeResult,
      outputFile: null,
      summaryFile: null,
      write: () => {},
    }),
    /1 checked AI crawler token is blocked/,
  );
});

test("can fail an enabled edge check when a synthetic response is restricted", async () => {
  await assert.rejects(
    runAction({
      website: "example.com",
      checkEdge: true,
      failOnRestricted: true,
      check: async () => fakeResult,
      edgeCheck: async () => fakeEdgeResult,
      outputFile: null,
      summaryFile: null,
      write: () => {},
    }),
    /1 synthetic AI search-crawler response is restricted/,
  );
});
