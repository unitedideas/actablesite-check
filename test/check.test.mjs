import assert from "node:assert/strict";
import test from "node:test";
import { checkWebsite, evaluateCrawlerAccess, normalizePublicUrl, parseRobotsGroups, starterPolicy } from "../lib/check.mjs";

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
  const fetchImpl = async () => new Response("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /", { status: 200 });
  const result = await checkWebsite("example.com", { fetchImpl });
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
