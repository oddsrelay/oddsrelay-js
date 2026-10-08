# Changelog

## 0.1.0 (unreleased)

First version, written against the OddsRelay API's OpenAPI document `2026-07-08`.

- One method per GET route: `odds`, `raw`, `event`, `sports`, `events`, `bookmakers`, `regions`, `coverage`,
  `status`, `health`, `usage`, `pricing`, `openapi`, `healthz`.
- The key from `ODDSRELAY_KEY` or the `apiKey` option, sent only as a Bearer header.
- `Accept-Encoding: gzip` on every request.
- ETags kept per URL and sent back as `If-None-Match`; a 304 resolves with `notModified: true`.
- `quote: true` passes through, and the `maxTokens` option quotes before the call.
- A 429 waits for `Retry-After`, up to three tries in all.
- `OddsRelayError` with the API's `code` and `requestId`; `InsufficientTokensError` for a 402.
- `tokens` and `rateLimit` from the response headers on every result and error.
- `CONTRACT_VERSION` exported.
