# Website indexability and AI crawler monitoring — CLI and GitHub Action

A dependency-free command-line tool and schedulable GitHub Action for checking production indexability state, AI crawler robots.txt policy, and optional synthetic homepage responses. It catches accidental `noindex`, canonical drift, response changes, and crawler-policy changes without adding a runtime dependency to the site.

The default check reports:

- homepage HTTP response
- `<meta name="robots">` directives
- `X-Robots-Tag` directives
- canonical URL
- robots.txt policy for eight named crawler tokens

It reports the homepage rule for:

- `OAI-SearchBot`, `GPTBot`, and `OAI-AdsBot`
- `Claude-SearchBot`, `ClaudeBot`, and `Claude-User`
- `PerplexityBot`
- `Google-Extended`

The checker separates search discovery, user-requested retrieval, model training, and ad validation instead of treating every “AI bot” as the same thing.

Choosing a monitoring layer? [Compare robots.txt monitoring approaches](https://actablesite.com/robots-txt-monitoring-tools?utm_source=github&utm_medium=repository&utm_campaign=robots-monitoring-comparison) by what they actually watch: file changes, resolved policy, real crawler logs, general page changes, or edge enforcement.

## Run it

Node.js 20 or newer is required.

Install with Homebrew on macOS or Linux:

```bash
brew install unitedideas/tap/actablesite-check
actablesite-check example.com
```

Or run the tagged release directly from GitHub:

```bash
npx github:unitedideas/actablesite-check#v1.5.0 example.com
```

Compare robots.txt with three synthetic AI search-crawler homepage requests:

```bash
actablesite-check example.com --edge
```

This sends separately labeled `OAI-SearchBot`, `Claude-SearchBot`, and `PerplexityBot` user-agent requests. It reports the observed HTTP status and whether Cloudflare response headers were present.

Machine-readable output:

```bash
actablesite-check example.com --json
```

Print a conservative starter policy that allows discovery while restricting named training controls:

```bash
actablesite-check --starter
```

## GitHub Action

Run the same check in CI without installing a package:

```yaml
- name: Check production indexability
  id: indexability
  uses: unitedideas/actablesite-check@v1
  with:
      website: example.com
      check-homepage-indexability: "true"
      fail-on-noindex: "true"
      fail-on-blocked: "false"
      check-edge-responses: "true"
      fail-on-restricted: "false"
```

The action writes a job summary and exposes `result`, `allowed-count`, `blocked-count`, `indexability-result`, `noindex-found`, `edge-result`, and `restricted-count` outputs. Homepage indexability inspection is on by default; set `fail-on-noindex` to `"true"` when a discovered `noindex` should fail deployment. Set `fail-on-blocked` to `"true"` when a blocked robots token should fail the workflow. Set `fail-on-restricted` to `"true"` only with `check-edge-responses: "true"` when a synthetic 401, 403, 429, or other restricted response should fail the workflow.

[Copy a scheduled or pull-request workflow](https://actablesite.com/ai-crawler-github-action) and review when to observe policy drift versus fail a deployment.

## What the result means

The homepage check reads the returned HTTP response, raw HTML, and response headers. It does not run browser JavaScript, so a client-rendered canonical or meta directive is outside its evidence boundary. A missing canonical is reported as information rather than treated as failure.

The parser follows robots.txt group precedence, longest matching path, wildcard paths, end anchors, and Allow-on-tie behavior for the requested homepage path.

An `ALLOWED` result means no matching robots.txt restriction won for that token on `/`. It does not prove that a provider can pass a firewall, that a request is an authentic provider bot, or that any system will crawl, index, cite, rank, recommend, or send traffic.

An edge result is also bounded evidence. The requests come from the machine running this tool, not from provider IP ranges, and do not authenticate a provider bot or prove that Cloudflare caused the response. A restriction may come from Cloudflare, another CDN or WAF, the origin, rate limiting, or application logic.

Private and local-network targets are rejected. Homepage and robots.txt responses are limited to 1 MB and fetches time out after 10 seconds.

## Browser version

Use the free visual [Cloudflare AI crawler checker](https://actablesite.com/cloudflare-ai-crawler-checker) or the broader [eight-token policy checker](https://actablesite.com/ai-crawler-checker). ActableSite also provides a public website readiness scan and a one-time repair report.

## Ongoing monitoring

[Crawler Watch](https://actablesite.com/crawler-watch?utm_source=github&utm_medium=action&utm_campaign=crawler-watch) monitors homepage response status, robots meta, X-Robots-Tag, canonical, the eight-token robots policy, synthetic crawler responses, `sitemap.xml`, and `llms.txt` every 15 minutes. A changed state must appear twice before it sends an email. The plan covers one public website for $9/month.

The service reads returned HTML and headers without running browser JavaScript. External crawler requests are synthetic. Neither check authenticates provider IP ranges or proves crawling, indexing, citation, ranking, or traffic.

## Development

```bash
npm test
node bin/actablesite-check.js actablesite.com
```

## License

MIT
