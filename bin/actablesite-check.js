#!/usr/bin/env node

import { checkWebsite, starterPolicy } from "../lib/check.mjs";

const args = process.argv.slice(2);
const json = args.includes("--json");
const starter = args.includes("--starter");
const help = args.includes("--help") || args.includes("-h");
const target = args.find((arg) => !arg.startsWith("-"));

if (help || (!target && !starter)) {
  console.log(`actablesite-check <website> [--json]
actablesite-check --starter

Checks the homepage robots.txt policy for eight current AI crawler tokens.

Examples:
  actablesite-check example.com
  actablesite-check https://example.com --json
  actablesite-check --starter`);
  process.exit(help ? 0 : 1);
}

if (starter) {
  process.stdout.write(starterPolicy);
  process.exit(0);
}

try {
  const result = await checkWebsite(target);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\nAI crawler policy for ${result.site}`);
    console.log(`robots.txt: ${result.state} · HTTP ${result.responseStatus}\n`);
    const agentWidth = Math.max(...result.crawlers.map(({ agent }) => agent.length));
    for (const crawler of result.crawlers) {
      const state = crawler.allowed ? "ALLOWED" : "BLOCKED";
      const rule = crawler.matchedDirective ? `${crawler.matchedGroup} → ${crawler.matchedDirective}` : "no matching restriction";
      console.log(`${crawler.agent.padEnd(agentWidth)}  ${state.padEnd(7)}  ${crawler.provider} · ${crawler.purpose} · ${rule}`);
    }
    console.log("\nA robots rule does not prove network access, indexing, citation, or ranking.");
    console.log("Broader public-site check: https://actablesite.com\n");
  }
} catch (error) {
  console.error(`actablesite-check: ${error instanceof Error ? error.message : "check failed"}`);
  process.exit(2);
}
