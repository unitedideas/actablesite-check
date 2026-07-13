# actablesite-check

A dependency-free command-line checker for the robots.txt policy tokens used by OpenAI, Anthropic, Perplexity, and Google AI products.

It reports the homepage rule for:

- `OAI-SearchBot`, `GPTBot`, and `OAI-AdsBot`
- `Claude-SearchBot`, `ClaudeBot`, and `Claude-User`
- `PerplexityBot`
- `Google-Extended`

The checker separates search discovery, user-requested retrieval, model training, and ad validation instead of treating every “AI bot” as the same thing.

Want alerts when the result changes? [Crawler Watch](https://actablesite.com/crawler-watch?utm_source=github&utm_medium=repository&utm_campaign=crawler-watch) checks this policy plus external homepage responses, `sitemap.xml`, and `llms.txt` every 15 minutes. It confirms a changed state twice before emailing you.

## Run it

Node.js 20 or newer is required.

Install with Homebrew on macOS or Linux:

```bash
brew install unitedideas/tap/actablesite-check
actablesite-check example.com
```

Or run the tagged release directly from GitHub:

```bash
npx github:unitedideas/actablesite-check#v1.2.0 example.com
```

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
- name: Check AI crawler policy
  id: ai-crawlers
  uses: unitedideas/actablesite-check@v1
  with:
    website: example.com
    fail-on-blocked: "false"
```

The action writes a job summary and exposes `result`, `allowed-count`, and `blocked-count` outputs. Set `fail-on-blocked` to `"true"` when any blocked checked token should fail the workflow.

[Copy a scheduled or pull-request workflow](https://actablesite.com/ai-crawler-github-action) and review when to observe policy drift versus fail a deployment.

## What the result means

The parser follows robots.txt group precedence, longest matching path, wildcard paths, end anchors, and Allow-on-tie behavior for the requested homepage path.

An `ALLOWED` result means no matching robots.txt restriction won for that token on `/`. It does not prove that a provider can pass a firewall, that a request is an authentic provider bot, or that any system will crawl, index, cite, rank, recommend, or send traffic.

Private and local-network targets are rejected. Responses are limited to 1 MB and fetches time out after 10 seconds.

## Browser version

Use the free visual checker at [actablesite.com/ai-crawler-checker](https://actablesite.com/ai-crawler-checker). ActableSite also provides a broader public website readiness scan and a one-time repair report.

## Ongoing monitoring

[Crawler Watch](https://actablesite.com/crawler-watch) runs the eight-token policy check plus external homepage responses, `sitemap.xml`, and `llms.txt` every 15 minutes. A changed state must appear twice before it sends an email. The plan covers one public website for $9/month.

The external requests are synthetic. They do not authenticate provider IP ranges or prove crawling, indexing, citation, ranking, or traffic.

## Development

```bash
npm test
node bin/actablesite-check.js actablesite.com
```

## License

MIT
