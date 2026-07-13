import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { checkEdgeResponses, checkHomepageIndexability, checkWebsite } from "../lib/check.mjs";

export const crawlerWatchActionUrl = "https://actablesite.com/crawler-watch?utm_source=github&utm_medium=action&utm_campaign=crawler-watch";

function markdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export async function runAction({
  website,
  failOnBlocked = false,
  checkIndexability = true,
  failOnNoindex = false,
  checkEdge = false,
  failOnRestricted = false,
  check = checkWebsite,
  indexabilityCheck = checkHomepageIndexability,
  edgeCheck = checkEdgeResponses,
  outputFile = process.env.GITHUB_OUTPUT,
  summaryFile = process.env.GITHUB_STEP_SUMMARY,
  write = (value) => process.stdout.write(value),
}) {
  if (!website?.trim()) throw new Error("The website input is required.");
  const [result, indexabilityResult, edgeResult] = await Promise.all([
    check(website.trim()),
    checkIndexability ? indexabilityCheck(website.trim()) : Promise.resolve(null),
    checkEdge ? edgeCheck(website.trim()) : Promise.resolve(null),
  ]);
  const blocked = result.crawlers.filter(({ allowed }) => !allowed);
  const allowed = result.crawlers.length - blocked.length;
  const restricted = edgeResult?.crawlers.filter(({ state }) => state === "restricted") || [];
  const compactResult = JSON.stringify(result);

  if (outputFile) {
    await appendFile(
      outputFile,
      `result=${compactResult}\nallowed-count=${allowed}\nblocked-count=${blocked.length}\nindexability-result=${JSON.stringify(indexabilityResult)}\nnoindex-found=${indexabilityResult?.noindex ? "true" : "false"}\nedge-result=${JSON.stringify(edgeResult)}\nrestricted-count=${restricted.length}\n`,
      "utf8",
    );
  }
  if (summaryFile) {
    const rows = result.crawlers
      .map((crawler) => `| ${markdown(crawler.agent)} | ${crawler.allowed ? "Allowed" : "Blocked"} | ${markdown(crawler.purpose)} |`)
      .join("\n");
    const edgeSection = edgeResult
      ? `\n\n### Synthetic homepage responses\n\n| Token | Observed response | Assessment |\n|---|---|---|\n${edgeResult.crawlers.map((crawler) => `| ${markdown(crawler.agent)} | ${crawler.status === null ? "No response" : `HTTP ${crawler.status}`} | ${markdown(crawler.state)} |`).join("\n")}\n\nCloudflare response headers observed: **${edgeResult.cloudflareObserved ? "yes" : "no"}**.\n\n${markdown(edgeResult.limits)}\n`
      : "";
    const indexabilitySection = indexabilityResult
      ? `## Homepage indexability\n\n| Signal | Observed value |\n|---|---|\n| HTTP response | ${indexabilityResult.responseStatus === null ? "No response" : `HTTP ${indexabilityResult.responseStatus}`} (${markdown(indexabilityResult.state)}) |\n| robots meta | ${markdown(indexabilityResult.metaRobots.length ? indexabilityResult.metaRobots.join(", ") : "Not declared")} |\n| X-Robots-Tag | ${markdown(indexabilityResult.xRobotsTag.length ? indexabilityResult.xRobotsTag.join(", ") : "Not declared")} |\n| Canonical | ${markdown(indexabilityResult.canonicalUrl || "Not declared")} |\n| noindex found | ${indexabilityResult.noindex ? "Yes" : "No"} |\n\n${markdown(indexabilityResult.limits)}\n\n`
      : "";
    await appendFile(
      summaryFile,
      `${indexabilitySection}## AI crawler policy for ${markdown(result.site)}\n\nrobots.txt: **${markdown(result.state)}** (HTTP ${result.responseStatus})\n\n| Token | Homepage rule | Purpose |\n|---|---|---|\n${rows}${edgeSection}\n\nA robots rule does not prove network access, indexing, citation, or ranking.\n\n### Keep watching between workflow runs\n\nThis Action is a point-in-time check. [Crawler Watch](${crawlerWatchActionUrl}) checks homepage indexability and AI crawler policy every 15 minutes, confirms a changed state twice, and emails the evidence for $9/month.\n`,
      "utf8",
    );
  }

  write(`${JSON.stringify(result, null, 2)}\n`);
  if (failOnBlocked && blocked.length) {
    throw new Error(`${blocked.length} checked AI crawler token${blocked.length === 1 ? " is" : "s are"} blocked.`);
  }
  if (failOnNoindex && indexabilityResult?.noindex) {
    throw new Error("Homepage noindex was found in robots meta or X-Robots-Tag.");
  }
  if (failOnRestricted && restricted.length) {
    throw new Error(`${restricted.length} synthetic AI search-crawler response${restricted.length === 1 ? " is" : "s are"} restricted.`);
  }
  return { result, indexabilityResult, edgeResult, allowedCount: allowed, blockedCount: blocked.length, restrictedCount: restricted.length };
}

async function main() {
  const failValue = (process.env.INPUT_FAIL_ON_BLOCKED || "false").trim().toLowerCase();
  const indexabilityValue = (process.env.INPUT_CHECK_HOMEPAGE_INDEXABILITY || "true").trim().toLowerCase();
  const failNoindexValue = (process.env.INPUT_FAIL_ON_NOINDEX || "false").trim().toLowerCase();
  const edgeValue = (process.env.INPUT_CHECK_EDGE_RESPONSES || "false").trim().toLowerCase();
  const failRestrictedValue = (process.env.INPUT_FAIL_ON_RESTRICTED || "false").trim().toLowerCase();
  if (!new Set(["true", "false"]).has(failValue)) {
    throw new Error("fail-on-blocked must be true or false.");
  }
  if (!new Set(["true", "false"]).has(indexabilityValue)) {
    throw new Error("check-homepage-indexability must be true or false.");
  }
  if (!new Set(["true", "false"]).has(failNoindexValue)) {
    throw new Error("fail-on-noindex must be true or false.");
  }
  if (failNoindexValue === "true" && indexabilityValue !== "true") {
    throw new Error("fail-on-noindex requires check-homepage-indexability to be true.");
  }
  if (!new Set(["true", "false"]).has(edgeValue)) {
    throw new Error("check-edge-responses must be true or false.");
  }
  if (!new Set(["true", "false"]).has(failRestrictedValue)) {
    throw new Error("fail-on-restricted must be true or false.");
  }
  if (failRestrictedValue === "true" && edgeValue !== "true") {
    throw new Error("fail-on-restricted requires check-edge-responses to be true.");
  }
  await runAction({
    website: process.env.INPUT_WEBSITE,
    failOnBlocked: failValue === "true",
    checkIndexability: indexabilityValue === "true",
    failOnNoindex: failNoindexValue === "true",
    checkEdge: edgeValue === "true",
    failOnRestricted: failRestrictedValue === "true",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`actablesite-check action: ${error instanceof Error ? error.message : "check failed"}`);
    process.exitCode = 1;
  });
}
