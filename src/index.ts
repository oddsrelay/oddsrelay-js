import type {
  BookmakersParams,
  Catalogue,
  Coverage,
  Event,
  EventParams,
  EventsParams,
  Health,
  MatchedBoard,
  OddsParams,
  OddsType,
  OpenApiDocument,
  Page,
  PriceTable,
  QueryParams,
  Quote,
  Quoted,
  RateLimit,
  RawBoard,
  RawEvent,
  RawParams,
  RegionParams,
  Regions,
  ResponseInfo,
  Result,
  Shaped,
  Sport,
  SportsParams,
  Status,
  Tokens,
  Usage,
} from "./types.js";

export type * from "./types.js";

/** The `info.version` of the OpenAPI file this client was written against. */
export const CONTRACT_VERSION = "2026-07-08";

const BASE_URL = "https://api.oddsrelay.io";
const MAX_TRIES = 3;
const MAX_ETAGS = 500;

export type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export interface ClientOptions {
  /** Your API key. Defaults to the ODDSRELAY_KEY environment variable. */
  apiKey?: string;
  /** A fetch to use instead of the global one. */
  fetch?: FetchLike;
  /** How to wait between 429 retries. Tests pass a stub. */
  sleep?: (ms: number) => Promise<void>;
}

export interface CallOptions {
  /**
   * Price the call with `quote=true` first, and make it only if it costs at most this many tokens.
   * Otherwise an OverBudgetError is thrown and nothing is spent.
   */
  maxTokens?: number;
}

type Auth = "required" | "optional" | "none";

/** Any non-2xx, non-304 reply. Branch on `code`; quote `requestId` when asking for help. */
export class OddsRelayError extends Error {
  override name = "OddsRelayError";
  readonly status: number;
  /** The API's `error.code`, or `http_<status>` when the reply had no JSON body. */
  readonly code: string;
  readonly requestId: string | undefined;
  readonly tokens: Tokens;
  readonly rateLimit: RateLimit;
  readonly headers: Headers;
  /** The `error` object exactly as sent, unknown fields included. */
  readonly body: Record<string, unknown> | undefined;

  constructor(info: ResponseInfo, body?: Record<string, unknown>) {
    const code = typeof body?.code === "string" ? body.code : `http_${info.status}`;
    super(`${code}: ${typeof body?.message === "string" ? body.message : `HTTP ${info.status}`}`);
    this.status = info.status;
    this.code = code;
    this.requestId = typeof body?.request_id === "string" ? body.request_id : info.requestId;
    this.tokens = info.tokens;
    this.rateLimit = info.rateLimit;
    this.headers = info.headers;
    this.body = body;
  }
}

/** A 402: the call costs more tokens than the account has left. */
export class InsufficientTokensError extends OddsRelayError {
  override name = "InsufficientTokensError";
  readonly cost: number | undefined;
  readonly remaining: number | undefined;
  /** When the pool resets, ISO 8601. */
  readonly resetsAt: string | undefined;

  constructor(info: ResponseInfo, body?: Record<string, unknown>) {
    super(info, body);
    this.cost = typeof body?.cost === "number" ? body.cost : undefined;
    this.remaining = typeof body?.remaining === "number" ? body.remaining : undefined;
    this.resetsAt = typeof body?.resets_at === "string" ? body.resets_at : undefined;
  }
}

/** Thrown before a call whose quote is above `maxTokens`. Nothing was spent. */
export class OverBudgetError extends Error {
  override name = "OverBudgetError";
  readonly quote: Quote;
  readonly maxTokens: number;

  constructor(quote: Quote, maxTokens: number) {
    super(`quote of ${quote.cost} tokens is above maxTokens ${maxTokens}: narrow the filters`);
    this.quote = quote;
    this.maxTokens = maxTokens;
  }
}

/** The OddsRelay API client. One method per GET route; filters go in the params object. */
export class OddsRelay {
  readonly #key: string | undefined;
  readonly #fetch: FetchLike;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #etags = new Map<string, string>();

  constructor(options: ClientOptions = {}) {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    this.#key = options.apiKey ?? env?.ODDSRELAY_KEY;
    this.#fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** A matched board: back prices paired with exchange lay prices. */
  odds<P extends OddsParams = {}>(type: OddsType, params?: P, options?: CallOptions) {
    return this.#data<Quoted<P, Shaped<P, MatchedBoard>>>(`/v2/odds/${encodeURIComponent(type)}`, params, options);
  }

  /** Every price per bookmaker and exchange, one page at a time (`cursor`). */
  raw<P extends RawParams = {}>(params?: P, options?: CallOptions) {
    return this.#data<Quoted<P, Shaped<P, RawBoard>>>("/v2/odds/raw", params, options);
  }

  /** Every price for one event. */
  event<P extends EventParams = {}>(id: string, params?: P, options?: CallOptions) {
    return this.#data<Quoted<P, RawEvent>>(`/v2/odds/event/${encodeURIComponent(id)}`, params, options);
  }

  /** Sports and competitions, paged. */
  sports<P extends SportsParams = {}>(params?: P) {
    return this.#get<Shaped<P, Page<Sport>>>("/v2/sports", params, "required");
  }

  /** Events for one sport, paged. */
  events<P extends EventsParams>(params: P) {
    return this.#get<Shaped<P, Page<Event>>>("/v2/events", params, "required");
  }

  /** The bookmaker and exchange catalogue. */
  bookmakers<P extends BookmakersParams = {}>(params?: P) {
    return this.#get<Shaped<P, Catalogue>>("/v2/bookmakers", params, "required");
  }

  /** The regions this key can read. */
  regions() {
    return this.#get<Regions>("/v2/regions", undefined, "required");
  }

  /** Which venues and sports each product carries. Works without a key; a key adds detail. */
  coverage(params?: RegionParams) {
    return this.#get<Coverage>("/v2/coverage", params, "optional");
  }

  /** Each product's state. No key needed. */
  status(params?: RegionParams) {
    return this.#get<Status>("/v2/status", params, "none");
  }

  /** The feed's health, board by board. */
  health() {
    return this.#get<Health>("/v2/health", undefined, "required");
  }

  /** This key's plan, token balance and scope. */
  usage() {
    return this.#get<Usage>("/v2/usage", undefined, "required");
  }

  /** The token rate card used to price calls. */
  pricing() {
    return this.#get<PriceTable>("/v2/pricing", undefined, "required");
  }

  /** The API's OpenAPI document. No key needed. */
  openapi() {
    return this.#get<OpenApiDocument>("/v2/openapi.json", undefined, "none");
  }

  /** The front door's plain-text liveness check. No key needed. */
  healthz() {
    return this.#get<string>("/healthz", undefined, "none", true);
  }

  async #data<T>(path: string, params: QueryParams | undefined, options: CallOptions | undefined): Promise<Result<T>> {
    const max = options?.maxTokens;
    if (max !== undefined && params?.quote !== true) {
      const priced = await this.#get<Quote>(path, { ...params, quote: true }, "required");
      if (!priced.notModified && priced.data.cost > max) throw new OverBudgetError(priced.data, max);
    }
    return this.#get<T>(path, params, "required");
  }

  async #get<T>(path: string, params: QueryParams | undefined, auth: Auth, text = false): Promise<Result<T>> {
    const url = BASE_URL + path + query(params);
    const headers: Record<string, string> = { "Accept-Encoding": "gzip" };
    if (auth !== "none" && this.#key) headers.Authorization = `Bearer ${this.#key}`;
    else if (auth === "required") throw new Error(`${path} needs an API key: set ODDSRELAY_KEY or pass { apiKey }`);
    const etag = this.#etags.get(url);
    if (etag) headers["If-None-Match"] = etag;

    for (let attempt = 1; ; attempt++) {
      const res = await this.#fetch(url, { headers });
      if (res.status === 429 && attempt < MAX_TRIES) {
        await res.body?.cancel();
        await this.#sleep((count(res.headers, "retry-after") ?? 1) * 1000);
        continue;
      }
      const info = describe(res);
      if (res.status === 304) return { ...info, notModified: true };
      if (!res.ok) throw await toError(res, info);
      if (info.etag) this.#remember(url, info.etag);
      const data = (text ? await res.text() : await res.json()) as T;
      return { ...info, notModified: false, data };
    }
  }

  #remember(url: string, etag: string) {
    this.#etags.delete(url);
    this.#etags.set(url, etag);
    // Drop the least recently stored URL, so a poller walking many cursors keeps memory bounded.
    if (this.#etags.size > MAX_ETAGS) this.#etags.delete(this.#etags.keys().next().value as string);
  }
}

function query(params: QueryParams = {}): string {
  const q = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    q.set(name, typeof value === "object" ? value.join(",") : String(value));
  }
  const s = q.toString().replace(/%2C/gi, ",");
  return s ? `?${s}` : "";
}

function count(headers: Headers, name: string): number | undefined {
  const v = headers.get(name);
  return v !== null && /^\d+$/.test(v) ? Number(v) : undefined;
}

function amount(headers: Headers, name: string): number | "unlimited" | undefined {
  return headers.get(name) === "unlimited" ? "unlimited" : count(headers, name);
}

function describe(res: Response): ResponseInfo {
  const h = res.headers;
  return {
    status: res.status,
    headers: h,
    requestId: h.get("x-oddsrelay-request-id") ?? undefined,
    etag: h.get("etag") ?? undefined,
    tokens: {
      cost: count(h, "x-tokens-cost"),
      used: count(h, "x-tokens-used"),
      remaining: amount(h, "x-tokens-remaining"),
      limit: amount(h, "x-tokens-limit"),
      reset: h.get("x-tokens-reset") ?? undefined,
    },
    rateLimit: {
      limit: count(h, "x-ratelimit-limit"),
      remaining: count(h, "x-ratelimit-remaining"),
      reset: count(h, "x-ratelimit-reset"),
    },
  };
}

async function toError(res: Response, info: ResponseInfo): Promise<OddsRelayError> {
  let body: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(await res.text());
    if (parsed?.error && typeof parsed.error === "object") body = parsed.error;
  } catch {
    // An empty or non-JSON body, as the front door's own 429 and 502 replies have.
  }
  return res.status === 402 ? new InsufficientTokensError(info, body) : new OddsRelayError(info, body);
}
