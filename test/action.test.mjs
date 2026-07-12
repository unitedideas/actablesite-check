import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runAction } from "../action/run.mjs";

const fakeResult = {
  site: "https://example.com/",
  state: "present",
  responseStatus: 200,
  crawlers: [
    { agent: "OAI-SearchBot", allowed: true, purpose: "search discovery" },
    { agent: "GPTBot", allowed: false, purpose: "model training" },
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
      outputFile,
      summaryFile,
      write: () => {},
    });
    assert.equal(run.allowedCount, 1);
    assert.equal(run.blockedCount, 1);
    assert.match(await readFile(outputFile, "utf8"), /blocked-count=1/);
    assert.match(await readFile(summaryFile, "utf8"), /GPTBot \| Blocked/);
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
