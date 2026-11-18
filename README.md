# oddsrelay

The OddsRelay API client for JavaScript and TypeScript: raw bookmaker odds for the UK & Ireland and more regions,
UK and Irish bookmakers matched to exchange lay prices, in-play prices, historical odds, sports, events and
coverage, with the token meter on every reply.

- No runtime dependencies. It uses the `fetch` built into Node 18 and later.
- ESM with TypeScript types. Return types follow your parameters (`format`, `quote`).
- Handles the API's rules for you: Bearer key, gzip, ETag polling, quotes, `Retry-After` and typed errors.

API docs: https://oddsrelay.io/docs

## Install

```sh
npm install oddsrelay
```

TypeScript projects also need `@types/node` (or the `DOM` lib) for the `Response` and `Headers` types.

## Get a key

Sign up at [app.oddsrelay.io/signup](https://app.oddsrelay.io/signup) and copy your key from the dashboard.
Free gives you 50,000 tokens for 14 days from sign-up, with no card, then no tokens until you choose a plan, on the same key. [Plans and token prices](https://oddsrelay.io/pricing).
Paid plans are for personal use. Any business, even one using the data only in-house, and any product that serves
other people runs on Enterprise; a business can try the data on Free first.

## First call

The status route needs no key, so this works straight after install:

```js
import { OddsRelay } from "oddsrelay";

const client = new OddsRelay();
const status = await client.status();
console.log(status.data);
```

Save it as `first.mjs` and run `node first.mjs`. (The examples use top-level `await`, so they need an ES module:
a `.mjs` file, or `"type": "module"` in your package.json.)

Data routes need a key (Get a key, above). Put it in the environment:

```sh
export ODDSRELAY_KEY=your_key_here
```

```js
import { OddsRelay } from "oddsrelay";

const client = new OddsRelay(); // reads ODDSRELAY_KEY

const res = await client.odds("standard", {
  region: "uk",
  sports: "soccer",
  markets: "h2h",
  bookmakers: "ladbrokes",
});

if (!res.notModified) {
  for (const event of res.data.data) {
    console.log(event.sport_title, event.home_team, "v", event.away_team, event.commence_time);
  }
}
console.log("tokens spent:", res.tokens.cost, "left:", res.tokens.remaining);
```

You can also pass the key yourself: `new OddsRelay({ apiKey })`.

## Regions

Raw prices, in-play prices, event states and historical odds come from every region `regions()` lists. `raw()` takes
one code, or several international codes in one call (`uk` is always asked alone). Every other method takes one code.

```js
const page = await client.raw({ region: "us", sports: "basketball" });
const both = await client.raw({ region: ["us", "global"], sports: "basketball" }); // one board, priced as the two together
const live = await client.raw({ region: "us", sports: "basketball", inPlay: "only" }); // prices on events in play
```

- The matched boards and the exchanges are served for `uk` only: elsewhere `odds()` throws an `OddsRelayError` with
  status 403 and code `product_not_in_region`.
- A call with no `region` reads `uk` when that is your account's home region. With another home region it throws
  with status 400 and code `region_required`: pass `region`.

## Methods

One method per data, lookup and historical route. Filters go in a params object and are sent as query parameters.

| Method | Route | Key |
|---|---|---|
| `odds(type, params?, options?)` | `/v2/odds/{type}`: a matched board (`standard`, `2up`, `dutching`, `each-way`, `extra-place`, `bog`) | yes |
| `raw(params?, options?)` | `/v2/odds/raw`: all bookmaker and exchange prices by event, paged with `cursor` | yes |
| `event(id, params?, options?)` | `/v2/odds/event/{id}`: every price for one event | yes |
| `sports(params?)` | `/v2/sports`: the sport keys you can filter on, paged | yes |
| `events({ sport, ...params })` | `/v2/events`: events for one sport, paged | yes |
| `eventsState(params?)` | `/v2/events/state`: each event's state in one region (scheduled, started, gone or merged); no tokens | yes |
| `eventsChanges({ since, ...params })` | `/v2/events/changes`: the state changes after `since`, in order; no tokens | yes |
| `bookmakers(params?)` | `/v2/bookmakers`: the bookmaker and exchange catalogue | yes |
| `regions()` | `/v2/regions`: which regions your key reaches | yes |
| `coverage(params?)` | `/v2/coverage`: venues and sports per product; a key adds detail | no |
| `status(params?)` | `/v2/status`: each product's state | no |
| `health()` | `/v2/health`: board-by-board health | yes |
| `usage()` | `/v2/usage`: your plan, token balance and key scope | yes |
| `pricing()` | `/v2/pricing`: the token rate card | yes |
| `openapi()` | `/v2/openapi.json`: the API's OpenAPI document | no |
| `healthz()` | `/healthz`: plain-text liveness check | no |
| `historyRaw({ date, sports, ...params }, options?)` | `/v2/historical/odds/raw`: the raw board as it stood at one moment | yes |
| `historyEvent(id, { from, ...params }, options?)` | `/v2/historical/events/{id}/odds`: one event's price changes over a window of up to 24 hours | yes |
| `closing({ date, sports, ...params }, options?)` | `/v2/historical/closing`: opening and closing prices of the events that started on one UTC day | yes |
| `historyFiles(params?)` | `/v2/historical/files`: the bulk day files, with each one's size and cost | yes |
| `downloadFile(tier, sport, file, params?, options?)` | `/v2/historical/files/{tier}/{sport}/{file}`: one bulk file, as a `Uint8Array` | yes |

Parameters:

- Lists can be arrays or comma strings: `sports: ["soccer", "tennis"]` and `sports: "soccer,tennis"` send the same thing.
- `true` and `false` are sent as strings. `undefined` and `null` are left out.
- Anything else you pass is sent as given, and the API answers `400 bad_request` for an unknown parameter.
- `format: "bare"` returns just the rows array, and the return type follows.

Responses are the API's JSON, untouched. Fields added to the API after this version still arrive.

## Historical odds

```js
import { writeFile } from "node:fs/promises";

const board = await client.historyRaw({ date: "2026-11-17T18:00:00Z", sports: "basketball", region: "us" }, { maxTokens: budget });
const moves = await client.historyEvent(eventId, { from: "2026-11-17T12:00:00Z", region: "us" }); // 24 hours, or pass `to`
const lines = await client.closing({ date: "2026-11-17", sports: "basketball", region: "us" });

const files = await client.historyFiles({ region: "uk" });
const file = await client.downloadFile("closing", "soccer", "2026-11-17.csv.gz", {}, { maxTokens: budget });
if (!file.notModified) await writeFile("2026-11-17.csv.gz", file.data); // a gzip CSV, saved as sent
```

Each region has its own archive with its own first day. A date before it throws with status 400 and code
`date_out_of_range`, and `err.body.earliest` and `err.body.latest` give the range that region holds. Outside `uk`
the archive holds bookmakers only. A file is charged in full when its download starts; `quote: true` or `maxTokens`
prices it first.

## Event states

`eventsState()` is a snapshot of every event's state in one region, and `eventsChanges()` follows it. Neither spends
tokens.

```js
const filters = { region: "us", sports: "basketball" };
const snapshot = await client.eventsState(filters);
let since = snapshot.data.meta.since; // from the first page

const log = await client.eventsChanges({ since, ...filters }); // the same filters as the snapshot
for (const change of log.data.data) rows.set(change.event.id, change.event);
since = log.data.meta.next_since; // call again at once while log.data.meta.more is true
```

If `since` is too old the API answers 410 with code `since_expired`: take a new snapshot.

## Every reply

Each method resolves to a result with the same fields:

| Field | What it holds |
|---|---|
| `data` | The parsed body. `undefined` on a 304. |
| `notModified` | `true` when the API answered 304 (see below). |
| `status` | The HTTP status. |
| `tokens` | `X-Tokens-*`: `cost`, `used`, `remaining`, `limit` (a number or `"unlimited"`), `reset` (ISO 8601). |
| `rateLimit` | `X-RateLimit-*`: `limit`, `remaining`, `reset` (seconds until the window ends). |
| `requestId` | `X-OddsRelay-Request-Id`, worth quoting when you ask for help. |
| `etag` | The reply's ETag. |
| `headers` | Every response header, as a `Headers` object. |

## Quotes

Pass `quote: true` to price a request without running it. You get `{ cost, remaining, rate_card }` back instead
of data, and the quote itself is not charged.

For calls that could be large, pass `maxTokens` as the last argument. The client quotes first and makes the call
only if the quote fits; otherwise it throws `OverBudgetError` and nothing is spent.

```js
import { OverBudgetError } from "oddsrelay";

try {
  // budget: the most tokens you are willing to spend on this one call
  const res = await client.raw({ region: "uk", sports: "tennis" }, { maxTokens: budget });
} catch (err) {
  if (err instanceof OverBudgetError) console.log(`quote was ${err.quote.cost}: narrow the filters`);
  else throw err;
}
```

## Conditional polling

The client keeps the ETag of each URL it has read and sends it back as `If-None-Match`. When nothing has changed,
the API answers 304 with no body, which is not charged, and the result has `notModified: true`. Keep the last
full reply and swap it only when new data arrives:

```js
let board;

async function refresh() {
  const res = await client.odds("standard", { region: "uk", sports: "soccer" });
  if (!res.notModified) board = res.data;
  return board;
}
```

ETags are kept in the client instance, so a new `OddsRelay()` starts with none.

## Errors

Every reply other than 2xx and 304 throws an `OddsRelayError`. Branch on `err.code`, the API's own error code
(`invalid_api_key`, `unknown_sport`, `not_in_key_scope` and so on). Codes added after this version arrive as
strings like any other. A reply with no JSON body gets the code `http_<status>`.

```js
import { InsufficientTokensError, OddsRelayError } from "oddsrelay";

try {
  await client.odds("standard", { region: "uk" });
} catch (err) {
  if (err instanceof InsufficientTokensError) {
    console.log(`needs ${err.cost}, ${err.remaining} left, resets ${err.resetsAt}`);
  } else if (err instanceof OddsRelayError) {
    console.log(err.status, err.code, err.message, err.requestId);
  } else {
    throw err; // network failure
  }
}
```

Each error also carries `tokens`, `rateLimit`, `headers` and `body` (the API's `error` object, unknown fields
included). A 402 is an `InsufficientTokensError` with `cost`, `remaining` and `resetsAt`.

## Rate limits

On a 429 the client waits for `Retry-After` and tries again, up to three tries in all. If the last try is still
429, it throws an `OddsRelayError` with `status` 429. A `Retry-After` longer than a minute is not waited out: the
client throws at once and leaves the decision to you. `res.rateLimit` shows where you stand in the current window.

## Your key

The key is sent only in the `Authorization: Bearer` header. It never goes in a URL, the client logs nothing, and
no error message or inspected client shows it. A key with a line break or another character a header cannot
carry is refused when the client is created, without echoing it. Keep it in the environment rather than in code, and leave it out
of anything you commit.

## API version

`CONTRACT_VERSION` is the `info.version` of the OpenAPI document this client was written against. To compare it
with the API you are calling:

```js
import { CONTRACT_VERSION } from "oddsrelay";

const spec = await client.openapi();
if (!spec.notModified && spec.data.info.version !== CONTRACT_VERSION) {
  console.log(`the API is at ${spec.data.info.version}, this client follows ${CONTRACT_VERSION}`);
}
```

## More from OddsRelay

- [oddsrelay-python](https://github.com/oddsrelay/oddsrelay-python): the Python client, `pip install oddsrelay`
- [oddsrelay-r](https://github.com/oddsrelay/oddsrelay-r): the R client
- [oddsrelay-mcp](https://github.com/oddsrelay/oddsrelay-mcp): an MCP server that gives Claude, Cursor and other AI assistants read access, with a token cap
- [oddsrelay-sheets](https://github.com/oddsrelay/oddsrelay-sheets): formulas and a template spreadsheet for Google Sheets
- [examples](https://github.com/oddsrelay/examples): short programs to copy, one folder each
- [Libraries and tools](https://oddsrelay.io/docs/libraries), the [docs](https://oddsrelay.io/docs), the [API reference](https://oddsrelay.io/docs/reference) and the [OpenAPI file](https://api.oddsrelay.io/v2/openapi.json)
- Contact: hello@oddsrelay.io

## License

MIT
