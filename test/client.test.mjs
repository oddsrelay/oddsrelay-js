// Runs against the compiled client in dist/. No network: every reply comes from a stub fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import {
  CONTRACT_VERSION,
  InsufficientTokensError,
  OddsRelay,
  OddsRelayError,
  OverBudgetError,
} from "../dist/index.js";

const KEY = "test-key-123";
delete process.env.ODDSRELAY_KEY; // a key in the shell must not leak into these tests
const fixture = (name) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");

/** A fetch that answers from a queue and records every request. */
function stub(...replies) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const next = replies.shift();
    assert.ok(next, `unexpected request to ${url}`);
    const [status, body = null, headers = {}] = next;
    return new Response(body, { status, headers });
  };
  return { fetch, calls };
}

const json = { "content-type": "application/json" };

test("exports the contract version", () => {
  assert.match(CONTRACT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("sends the key as a Bearer header from ODDSRELAY_KEY, never in the URL, and always asks for gzip", async () => {
  process.env.ODDSRELAY_KEY = KEY;
  try {
    const { fetch, calls } = stub([200, fixture("v2-sports.page.json"), json]);
    const res = await new OddsRelay({ fetch }).sports({ region: "uk" });
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
    assert.equal(calls[0].headers["Accept-Encoding"], "gzip");
    assert.equal(calls[0].url, "https://api.oddsrelay.io/v2/sports?region=uk");
    assert.ok(!calls[0].url.includes(KEY));
    assert.equal(res.notModified, false);
    assert.equal(res.data.data[0].key, "american_football_american_football");
  } finally {
    delete process.env.ODDSRELAY_KEY;
  }
});

test("the apiKey option wins over the environment", async () => {
  process.env.ODDSRELAY_KEY = "from-env";
  try {
    const { fetch, calls } = stub([200, "{}", json]);
    await new OddsRelay({ apiKey: KEY, fetch }).usage();
    assert.equal(calls[0].headers.Authorization, `Bearer ${KEY}`);
  } finally {
    delete process.env.ODDSRELAY_KEY;
  }
});

test("a keyed route without a key fails before any request", async () => {
  const { fetch, calls } = stub();
  await assert.rejects(new OddsRelay({ fetch }).odds("standard"), /needs an API key: set ODDSRELAY_KEY/);
  assert.equal(calls.length, 0);
});

test("keyless routes: status never sends the key, coverage sends it only when there is one", async () => {
  const keyed = stub([200, fixture("v2-status.status.json"), json], [200, "{}", json]);
  const client = new OddsRelay({ apiKey: KEY, fetch: keyed.fetch });
  const status = await client.status();
  assert.equal(status.data.products.raw, "ok");
  await client.coverage({ region: "uk" });
  assert.equal(keyed.calls[0].headers.Authorization, undefined);
  assert.equal(keyed.calls[1].headers.Authorization, `Bearer ${KEY}`);

  const anon = stub([200, "{}", json]);
  await new OddsRelay({ fetch: anon.fetch }).coverage();
  assert.equal(anon.calls[0].headers.Authorization, undefined);
});

test("filters pass through: lists become comma lists, flags become strings, empty values are dropped", async () => {
  const { fetch, calls } = stub([200, "{}", json], [200, "{}", json]);
  const client = new OddsRelay({ apiKey: KEY, fetch });
  await client.odds("each-way", { sports: ["horse_racing", "greyhounds"], markets: "each_way", region: undefined });
  await client.raw({ includeLinks: true, limit: 50, cursor: "abc=" });
  assert.equal(calls[0].url, "https://api.oddsrelay.io/v2/odds/each-way?sports=horse_racing,greyhounds&markets=each_way");
  assert.equal(calls[1].url, "https://api.oddsrelay.io/v2/odds/raw?includeLinks=true&limit=50&cursor=abc%3D");
});

test("every route has a method on the right path", async () => {
  const routes = [
    ["odds", ["2up"], "/v2/odds/2up"],
    ["raw", [], "/v2/odds/raw"],
    ["event", ["or_evt_1"], "/v2/odds/event/or_evt_1"],
    ["sports", [], "/v2/sports"],
    ["events", [{ sport: "soccer" }], "/v2/events?sport=soccer"],
    ["bookmakers", [], "/v2/bookmakers"],
    ["regions", [], "/v2/regions"],
    ["coverage", [], "/v2/coverage"],
    ["status", [], "/v2/status"],
    ["health", [], "/v2/health"],
    ["usage", [], "/v2/usage"],
    ["pricing", [], "/v2/pricing"],
    ["openapi", [], "/v2/openapi.json"],
  ];
  const { fetch, calls } = stub(...routes.map(() => [200, "{}", json]), [200, "ok\n", { "content-type": "text/plain" }]);
  const client = new OddsRelay({ apiKey: KEY, fetch });
  for (const [method, args] of routes) await client[method](...args);
  const text = await client.healthz();
  assert.equal(text.data, "ok\n");
  assert.deepEqual(
    calls.map((c) => c.url.replace("https://api.oddsrelay.io", "")),
    [...routes.map((r) => r[2]), "/healthz"],
  );
});

test("keeps the ETag per URL, sends If-None-Match, and returns a 304 as not modified", async () => {
  const meter = {
    "x-tokens-cost": "0",
    "x-tokens-used": "120",
    "x-tokens-remaining": "unlimited",
    "x-tokens-limit": "unlimited",
    "x-tokens-reset": "2026-11-01T00:00:00Z",
    "x-ratelimit-limit": "60",
    "x-ratelimit-remaining": "58",
    "x-ratelimit-reset": "7",
  };
  const { fetch, calls } = stub(
    [200, fixture("v2-sports.page.json"), { ...json, etag: '"c1-2-gz"', "x-tokens-cost": "3" }],
    [304, null, meter],
    [200, "{}", json],
  );
  const client = new OddsRelay({ apiKey: KEY, fetch });
  const first = await client.sports();
  assert.equal(first.etag, '"c1-2-gz"');
  assert.equal(first.tokens.cost, 3);

  const again = await client.sports();
  assert.equal(calls[1].headers["If-None-Match"], '"c1-2-gz"');
  assert.equal(again.notModified, true);
  assert.equal(again.status, 304);
  assert.equal(again.data, undefined);
  assert.deepEqual(again.tokens, { cost: 0, used: 120, remaining: "unlimited", limit: "unlimited", reset: "2026-11-01T00:00:00Z" });
  assert.deepEqual(again.rateLimit, { limit: 60, remaining: 58, reset: 7 });

  await client.sports({ region: "uk" });
  assert.equal(calls[2].headers["If-None-Match"], undefined, "another URL has its own ETag");
});

test("a 429 waits Retry-After and tries again", async () => {
  const waits = [];
  const { fetch, calls } = stub([429, null, { "retry-after": "2" }], [200, fixture("v2-status.status.json"), json]);
  const res = await new OddsRelay({ fetch, sleep: async (ms) => void waits.push(ms) }).status();
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [2000]);
});

test("a 429 gives up after three tries with a typed error", async () => {
  const waits = [];
  const { fetch, calls } = stub([429, null, {}], [429, null, { "retry-after": "1" }], [429, null, { "retry-after": "1" }]);
  const err = await new OddsRelay({ fetch, sleep: async (ms) => void waits.push(ms) }).status().catch((e) => e);
  assert.ok(err instanceof OddsRelayError);
  assert.equal(err.status, 429);
  assert.equal(err.code, "http_429");
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [1000, 1000]);
});

test("a 402 is an InsufficientTokensError carrying cost, remaining and the reset time", async () => {
  const { fetch } = stub([402, fixture("error-402.insufficient_tokens.json"), { ...json, "x-tokens-cost": "0" }]);
  const err = await new OddsRelay({ apiKey: KEY, fetch }).odds("standard").catch((e) => e);
  assert.ok(err instanceof InsufficientTokensError);
  assert.ok(err instanceof OddsRelayError);
  assert.equal(err.code, "insufficient_tokens");
  assert.equal(err.cost, 0);
  assert.equal(err.remaining, 0);
  assert.equal(err.resetsAt, "2026-10-01T00:00:00Z");
  assert.equal(err.requestId, "or_req_00000000000000000000000000000000");
  assert.equal(err.tokens.cost, 0);
});

test("other errors are typed by error.code, keep request_id, and accept codes and fields this client does not know", async () => {
  const novel = JSON.stringify({ error: { code: "brand_new_code", message: "Something new.", request_id: "or_req_9", hint: 1 } });
  const { fetch } = stub([401, fixture("error-401.invalid_api_key.json"), json], [403, novel, json], [502, "Bad Gateway"]);
  const client = new OddsRelay({ apiKey: KEY, fetch });

  const e401 = await client.usage().catch((e) => e);
  assert.equal(e401.status, 401);
  assert.equal(e401.code, "invalid_api_key");
  assert.equal(e401.requestId, "or_req_00000000000000000000000000000000");
  assert.equal(e401.message, "invalid_api_key: API key not recognised.");

  const e403 = await client.usage().catch((e) => e);
  assert.equal(e403.code, "brand_new_code");
  assert.equal(e403.body.hint, 1);

  const e502 = await client.usage().catch((e) => e);
  assert.equal(e502.code, "http_502");
  assert.equal(e502.body, undefined);
});

test("the key never shows in an error, its stack or an inspected client", async () => {
  const { fetch } = stub([401, fixture("error-401.invalid_api_key.json"), json]);
  const client = new OddsRelay({ apiKey: KEY, fetch });
  const err = await client.usage().catch((e) => e);
  for (const text of [err.message, err.stack, inspect(err, { depth: 5 }), JSON.stringify(err), inspect(client, { depth: 5 })]) {
    assert.ok(!String(text).includes(KEY), text);
  }
});

test("maxTokens quotes first and makes the call only when the quote fits", async () => {
  const quote = (cost) => [200, JSON.stringify({ cost, remaining: 900, rate_card: "2026-09" }), json];
  const { fetch, calls } = stub(quote(40), [200, '{"meta":{},"data":[],"later_field":true}', json], quote(400));
  const client = new OddsRelay({ apiKey: KEY, fetch });

  const res = await client.odds("standard", { sports: "soccer" }, { maxTokens: 100 });
  assert.equal(calls[0].url, "https://api.oddsrelay.io/v2/odds/standard?sports=soccer&quote=true");
  assert.equal(calls[1].url, "https://api.oddsrelay.io/v2/odds/standard?sports=soccer");
  assert.equal(res.data.later_field, true, "unknown fields are kept");

  const err = await client.odds("standard", { sports: "soccer" }, { maxTokens: 100 }).catch((e) => e);
  assert.ok(err instanceof OverBudgetError);
  assert.equal(err.quote.cost, 400);
  assert.equal(calls.length, 3, "the expensive call was never made");
});

test("quote: true returns the quote itself", async () => {
  const { fetch, calls } = stub([200, fixture("v2-odds-type.quote.json"), json]);
  const res = await new OddsRelay({ apiKey: KEY, fetch }).raw({ quote: true });
  assert.equal(calls[0].url, "https://api.oddsrelay.io/v2/odds/raw?quote=true");
  assert.equal(res.data.rate_card, "2026-09");
});
