# Security policy

## Supported version

Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Email `support@actablesite.com` with a concise description, reproduction steps, affected version, and expected impact. Do not include live credentials, private-page content, or unrelated personal data.

Please allow a reasonable investigation window before public disclosure. This repository does not offer a bug bounty or guarantee a specific remediation timeline.

The CLI rejects private and local-network targets by default, limits fetched robots.txt responses to 1 MB, and applies a ten-second request timeout.
