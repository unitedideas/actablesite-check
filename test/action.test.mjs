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

const fakeIndexabilityResult = {
  site: "https://example.com",
  finalUrl: "https://example.com/",
  responseStatus: 200,
  state: "reachable",
  metaRobots: ["index", "follow"],
  xRobotsTag: [],
  canonicalUrl: "https://example.com/",
  noindex: false,
  limits: "Raw HTML and headers only; browser JavaScript is not run.",
};

test("writes stable GitHub Action outputs and a summary", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "actablesite-action-"));
  const outputFile = path.join(directory, "output");
  const summaryFile = path.join(directory, "summary");
  try {
    const run = await runAction({
      website: "example.com",
      check: async () => fakeResult,
      indexabilityCheck: async () => fakeIndexabilityResult,
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
    assert.match(outputs, /noindex-found=false/);
    assert.match(outputs, /indexability-result=.*canonicalUrl/);
    assert.match(outputs, /restricted-count=1/);
    assert.match(outputs, /edge-result=.*Claude-SearchBot/);
    const summary = await readFile(summaryFile, "utf8");
    assert.match(summary, /GPTBot \| Blocked/);
    assert.match(summary, /Homepage indexability/);
    assert.match(summary, /Canonical \| https:\/\/example.com\//);
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

test("attributes the README comparison and monitoring continuations", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const links = [...readme.matchAll(/\[Crawler Watch\]\(([^)]+)\)/g)].map((match) => new URL(match[1]));
  assert.equal(links.length, 1);
  for (const link of links) {
    assert.equal(link.origin, "https://actablesite.com");
    assert.equal(link.pathname, "/crawler-watch");
    assert.deepEqual(Object.fromEntries(link.searchParams), {
      utm_source: "github",
      utm_medium: "action",
      utm_campaign: "crawler-watch",
    });
  }

  const comparisonMatch = readme.match(/\[Compare robots\.txt monitoring approaches\]\(([^)]+)\)/);
  assert.ok(comparisonMatch);
  const comparisonLink = new URL(comparisonMatch[1]);
  assert.equal(comparisonLink.origin, "https://actablesite.com");
  assert.equal(comparisonLink.pathname, "/robots-txt-monitoring-tools");
  assert.deepEqual(Object.fromEntries(comparisonLink.searchParams), {
    utm_source: "github",
    utm_medium: "repository",
    utm_campaign: "robots-monitoring-comparison",
  });
});

test("Marketplace metadata names the production indexability job", async () => {
  const metadata = await readFile(new URL("../action.yml", import.meta.url), "utf8");
  const description = metadata.match(/^description: (.+)$/m)?.[1] || "";
  assert.equal(description, "Guard robots.txt, homepage noindex, canonical, and optional AI-crawler edge responses in GitHub Actions.");
  assert.ok(description.length <= 125);
});

test("can fail a workflow when a checked token is blocked", async () => {
  await assert.rejects(
    runAction({
      website: "example.com",
      failOnBlocked: true,
      check: async () => fakeResult,
      indexabilityCheck: async () => fakeIndexabilityResult,
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
      indexabilityCheck: async () => fakeIndexabilityResult,
      edgeCheck: async () => fakeEdgeResult,
      outputFile: null,
      summaryFile: null,
      write: () => {},
    }),
    /1 synthetic AI search-crawler response is restricted/,
  );
});

test("can fail a workflow when homepage noindex is found", async () => {
  await assert.rejects(
    runAction({
      website: "example.com",
      failOnNoindex: true,
      check: async () => fakeResult,
      indexabilityCheck: async () => ({ ...fakeIndexabilityResult, metaRobots: ["noindex"], noindex: true }),
      outputFile: null,
      summaryFile: null,
      write: () => {},
    }),
    /Homepage noindex was found/,
  );
});
