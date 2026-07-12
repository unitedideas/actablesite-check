# actablesite-check

A dependency-free command-line checker for the robots.txt policy tokens used by OpenAI, Anthropic, Perplexity, and Google AI products.

It reports the homepage rule for:

- `OAI-SearchBot`, `GPTBot`, and `OAI-AdsBot`
- `Claude-SearchBot`, `ClaudeBot`, and `Claude-User`
- `PerplexityBot`
- `Google-Extended`

The checker separates search discovery, user-requested retrieval, model training, and ad validation instead of treating every “AI bot” as the same thing.

## Run it

Node.js 20 or newer is required.

```bash
npx github:unitedideas/actablesite-check example.com
```

Machine-readable output:

```bash
npx github:unitedideas/actablesite-check example.com --json
```

Print a conservative starter policy that allows discovery while restricting named training controls:

```bash
npx github:unitedideas/actablesite-check --starter
```

## What the result means

The parser follows robots.txt group precedence, longest matching path, wildcard paths, end anchors, and Allow-on-tie behavior for the requested homepage path.

An `ALLOWED` result means no matching robots.txt restriction won for that token on `/`. It does not prove that a provider can pass a firewall, that a request is an authentic provider bot, or that any system will crawl, index, cite, rank, recommend, or send traffic.

Private and local-network targets are rejected. Responses are limited to 1 MB and fetches time out after 10 seconds.

## Browser version

Use the free visual checker at [actablesite.com/ai-crawler-checker](https://actablesite.com/ai-crawler-checker). ActableSite also provides a broader public website readiness scan and a one-time repair report.

## Development

```bash
npm test
node bin/actablesite-check.js actablesite.com
```

## License

MIT
