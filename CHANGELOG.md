# Changelog

## 0.1.1 (2026-10-11)

README and package page only: the code is the same as 0.1.0.

- A "Get a key" section: where to sign up, and what the Free plan gives you.
- Links to the other OddsRelay clients, the MCP server, the Google Sheets template, the examples and the docs.

## 0.1.0 (2026-10-09)

First version, written against the OddsRelay API's OpenAPI document `2026-07-08`.

- One method per GET route: `odds`, `raw`, `event`, `sports`, `events`, `bookmakers`, `regions`, `coverage`,
  `status`, `health`, `usage`, `pricing`, `openapi`, `healthz`.
- The key from `ODDSRELAY_KEY` or the `apiKey` option, sent only as a Bearer header.
- `Accept-Encoding: gzip` on every request.
- ETags kept per URL, once a reply's body has arrived whole, and sent back as `If-None-Match`; a 304 resolves
  with `notModified: true`.
- `quote: true` passes through, and the `maxTokens` option quotes before the call.
- A 429 waits for `Retry-After`, up to three tries in all; a `Retry-After` longer than a minute throws at once.
- A key that an HTTP header cannot carry is refused when the client is created, and never echoed.
- `OddsRelayError` with the API's `code` and `requestId`; `InsufficientTokensError` for a 402.
- `tokens` and `rateLimit` from the response headers on every result and error.
- `CONTRACT_VERSION` exported.
