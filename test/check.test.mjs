import assert from "node:assert/strict";
import test from "node:test";
import { checkWebsite, crawlerWatchPitch, crawlerWatchUrl, evaluateCrawlerAccess, normalizePublicUrl, parseRobotsGroups, starterPolicy } from "../lib/check.mjs";

test("publishes one explicit source-attributed monitoring path", () => {
  const url = new URL(crawlerWatchUrl);
  assert.equal(url.origin, "https://actablesite.com");
  assert.equal(url.pathname, "/crawler-watch");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    utm_source: "actablesite-check",
    utm_medium: "cli",
    utm_campaign: "crawler-watch",
  });
  assert.match(crawlerWatchPitch, /one public site/);
  assert.match(crawlerWatchPitch, /15 minutes/);
  assert.match(crawlerWatchPitch, /confirmed changes/);
  assert.match(crawlerWatchPitch, /email/);
  assert.match(crawlerWatchPitch, /\$9\/month/);
});

test("normalizes public domains to robots.txt", () => {
  assert.equal(normalizePublicUrl("example.com/path?q=1").toString(), "https://example.com/robots.txt");
  assert.throws(() => normalizePublicUrl("http://127.0.0.1"), /Private/);
  assert.throws(() => normalizePublicUrl("file:///tmp/test"), /http/);
});

test("parses groups and prefers a specific crawler group", () => {
  const policy = "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /";
  assert.equal(parseRobotsGroups(policy).length, 2);
  assert.deepEqual(evaluateCrawlerAccess(policy, "OAI-SearchBot"), {
    allowed: true,
    matchedDirective: "Allow: /",
    matchedGroup: "OAI-SearchBot",
  });
  assert.equal(evaluateCrawlerAccess(policy, "ClaudeBot").allowed, false);
});

test("uses longest path and Allow on an equal-length tie", () => {
  const policy = "User-agent: GPTBot\nDisallow: /\nDisallow: /public\nAllow: /public";
  assert.deepEqual(evaluateCrawlerAccess(policy, "GPTBot", "/public/page"), {
    allowed: true,
    matchedDirective: "Allow: /public",
    matchedGroup: "GPTBot",
  });
});

test("returns eight policy results without network access", async () => {
  let userAgent;
  const fetchImpl = async (_url, options) => {
    userAgent = options.headers["user-agent"];
    return new Response("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /", { status: 200 });
  };
  const result = await checkWebsite("example.com", { fetchImpl });
  assert.equal(userAgent, "actablesite-check/1.3.1");
  assert.equal(result.crawlers.length, 8);
  assert.equal(result.crawlers.find(({ agent }) => agent === "GPTBot").allowed, false);
  assert.equal(result.crawlers.find(({ agent }) => agent === "PerplexityBot").allowed, true);
});

test("treats a missing robots.txt as unrestricted there", async () => {
  const fetchImpl = async () => new Response("Not found", { status: 404 });
  const result = await checkWebsite("example.com", { fetchImpl });
  assert.equal(result.state, "missing");
  assert.equal(result.crawlers.every(({ allowed }) => allowed), true);
});

test("starter policy separates discovery from training", () => {
  assert.equal(evaluateCrawlerAccess(starterPolicy, "OAI-SearchBot").allowed, true);
  assert.equal(evaluateCrawlerAccess(starterPolicy, "GPTBot").allowed, false);
  assert.equal(evaluateCrawlerAccess(starterPolicy, "ClaudeBot").allowed, false);
});
