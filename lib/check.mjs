const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|::1|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export const crawlerWatchUrl = "https://actablesite.com/crawler-watch?utm_source=actablesite-check&utm_medium=cli&utm_campaign=crawler-watch";
export const crawlerWatchPitch = "Monitor one public site every 15 minutes; confirmed changes arrive by email for $9/month.";

export const crawlerDefinitions = [
  { agent: "OAI-SearchBot", provider: "OpenAI", purpose: "ChatGPT search", category: "search" },
  { agent: "GPTBot", provider: "OpenAI", purpose: "Model training", category: "training" },
  { agent: "OAI-AdsBot", provider: "OpenAI", purpose: "Ad validation", category: "ads" },
  { agent: "Claude-SearchBot", provider: "Anthropic", purpose: "Claude search", category: "search" },
  { agent: "ClaudeBot", provider: "Anthropic", purpose: "Model training", category: "training" },
  { agent: "Claude-User", provider: "Anthropic", purpose: "User-requested retrieval", category: "user" },
  { agent: "PerplexityBot", provider: "Perplexity", purpose: "Perplexity search", category: "search" },
  { agent: "Google-Extended", provider: "Google", purpose: "Gemini training and grounding control", category: "training" },
];

export const searchCrawlerDefinitions = crawlerDefinitions.filter(({ category }) => category === "search");

export const syntheticResponseLimit = "Synthetic user-agent requests do not originate from provider IP ranges, authenticate a provider bot, identify the cause of a response, or prove crawling, indexing, citation, ranking, referral traffic, or revenue.";

export const starterPolicy = `# Search and answer discovery
User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

# User-requested retrieval
User-agent: Claude-User
Allow: /

# Training and Gemini grounding control
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /
`;

export function normalizePublicUrl(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 2048) throw new Error("Enter one public website URL.");
  const trimmed = input.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) throw new Error("Only http and https URLs are supported.");
  const raw = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only http and https URLs are supported.");
  const host = url.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) || host.endsWith(".local")) throw new Error("Private and local-network targets are not supported.");
  url.pathname = "/robots.txt";
  url.search = "";
  url.hash = "";
  return url;
}

export function parseRobotsGroups(text) {
  const groups = [];
  let agents = [];
  let rules = [];
  const finish = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (agents.length && rules.length) finish();
      agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && agents.length) {
      rules.push({ directive: field, path: value });
    }
  }
  finish();
  return groups;
}

function pathMatches(rulePath, pathname) {
  if (!rulePath) return false;
  const endAnchored = rulePath.endsWith("$");
  const raw = endAnchored ? rulePath.slice(0, -1) : rulePath;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${endAnchored ? "$" : ""}`).test(pathname);
}

export function evaluateCrawlerAccess(text, agent, pathname = "/") {
  const groups = parseRobotsGroups(text);
  const token = agent.toLowerCase();
  const specific = groups.filter((group) => group.agents.includes(token));
  const selected = specific.length ? specific : groups.filter((group) => group.agents.includes("*"));
  const matches = selected.flatMap((group) => group.rules).filter((rule) => pathMatches(rule.path, pathname));
  if (!matches.length) return { allowed: true, matchedDirective: null, matchedGroup: specific.length ? agent : selected.length ? "*" : null };
  matches.sort((a, b) => {
    const lengthDifference = b.path.replace(/[*$]/g, "").length - a.path.replace(/[*$]/g, "").length;
    if (lengthDifference) return lengthDifference;
    return a.directive === b.directive ? 0 : a.directive === "allow" ? -1 : 1;
  });
  const winner = matches[0];
  return {
    allowed: winner.directive === "allow",
    matchedDirective: `${winner.directive === "allow" ? "Allow" : "Disallow"}: ${winner.path}`,
    matchedGroup: specific.length ? agent : "*",
  };
}

export function classifySyntheticResponse(status) {
  if (status === null) return "unavailable";
  if (status >= 200 && status < 400) return "reachable";
  if (status === 401 || status === 403 || status === 429) return "restricted";
  if (status >= 500) return "unavailable";
  return "restricted";
}

async function checkSyntheticResponse(siteUrl, definition, { fetchImpl, timeoutMs }) {
  try {
    const response = await fetchImpl(siteUrl, {
      headers: {
        accept: "text/html,*/*;q=0.5",
        "user-agent": `${definition.agent}/1.0 (+https://github.com/unitedideas/actablesite-check)`,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const status = response.status;
    const cloudflareObserved = response.headers.has("cf-ray") || response.headers.get("server")?.toLowerCase() === "cloudflare";
    await response.body?.cancel();
    return {
      ...definition,
      status,
      state: classifySyntheticResponse(status),
      cloudflareObserved,
    };
  } catch {
    return {
      ...definition,
      status: null,
      state: classifySyntheticResponse(null),
      cloudflareObserved: false,
    };
  }
}

export async function checkEdgeResponses(input, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const robotsUrl = normalizePublicUrl(input);
  const siteUrl = new URL(robotsUrl.origin);
  const crawlers = await Promise.all(
    searchCrawlerDefinitions.map((definition) => checkSyntheticResponse(siteUrl, definition, { fetchImpl, timeoutMs })),
  );
  return {
    site: siteUrl.origin,
    checkedAt: new Date().toISOString(),
    cloudflareObserved: crawlers.some(({ cloudflareObserved }) => cloudflareObserved),
    crawlers,
    limits: syntheticResponseLimit,
  };
}

export async function checkWebsite(input, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const robotsUrl = normalizePublicUrl(input);
  const response = await fetchImpl(robotsUrl, {
    headers: { accept: "text/plain,*/*;q=0.5", "user-agent": "actablesite-check/1.4.2" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (body.length > 1_000_000) throw new Error("robots.txt exceeds the 1 MB safety limit.");
  const missing = response.status === 404;
  if (!response.ok && !missing) throw new Error(`robots.txt returned HTTP ${response.status}.`);
  return {
    site: robotsUrl.origin,
    robotsUrl: robotsUrl.toString(),
    checkedAt: new Date().toISOString(),
    responseStatus: response.status,
    state: missing ? "missing" : "found",
    crawlers: crawlerDefinitions.map((definition) => {
      const result = missing ? { allowed: true, matchedDirective: null, matchedGroup: null } : evaluateCrawlerAccess(body, definition.agent);
      return { ...definition, ...result };
    }),
  };
}
