// Shapes of the OddsRelay /v2 API, written from its OpenAPI file.
// The API only adds fields and codes, so anything not listed here still arrives at runtime, untouched.

/** A value the client can put in a query string. Arrays are sent as comma lists. */
export type QueryValue = string | number | boolean | readonly string[];

/** Any extra parameter passes through as-is; the API refuses ones it does not know. */
export interface QueryParams {
  [name: string]: QueryValue | undefined | null;
}

type List = string | readonly string[];
type Flag = boolean | "true" | "false";
type Format = "envelope" | "bare";
type OddsFormat = "decimal" | "american";
type DateFormat = "iso" | "unix";

/** The matched boards. The API may add more. */
export type OddsType =
  | "standard"
  | "2up"
  | "dutching"
  | "each-way"
  | "extra-place"
  | "bog"
  | "two-up"
  | "each_way"
  | "extra_place"
  | (string & {});

export interface OddsParams extends QueryParams {
  region?: string;
  format?: Format;
  oddsFormat?: OddsFormat;
  dateFormat?: DateFormat;
  quote?: boolean;
  sports?: List;
  bookmakers?: List;
  exchanges?: List;
  markets?: List;
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
}

export interface RawParams extends QueryParams {
  region?: string;
  format?: Format;
  oddsFormat?: OddsFormat;
  dateFormat?: DateFormat;
  quote?: boolean;
  sports?: List;
  sport?: string;
  leagues?: List;
  bookmakers?: List;
  requireBookmakers?: List;
  markets?: List;
  eventIds?: List;
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
  updatedSince?: string;
  exchangesOnly?: Flag;
  includeLinks?: Flag;
  includeLiquidity?: Flag;
  cursor?: string;
  /** Events per page, 1 to 250. */
  limit?: number;
}

export interface EventParams extends QueryParams {
  region?: string;
  oddsFormat?: OddsFormat;
  dateFormat?: DateFormat;
  includeLinks?: Flag;
  includeLiquidity?: Flag;
  quote?: boolean;
}

export interface SportsParams extends QueryParams {
  region?: string;
  format?: Format;
  dateFormat?: DateFormat;
  cursor?: string;
}

export interface EventsParams extends QueryParams {
  sport: string;
  region?: string;
  format?: Format;
  dateFormat?: DateFormat;
  cursor?: string;
  eventIds?: List;
  commenceTimeFrom?: string;
  commenceTimeTo?: string;
}

export interface BookmakersParams extends QueryParams {
  format?: Format;
}

export interface RegionParams extends QueryParams {
  region?: string;
}

/** What a `quote: true` call returns instead of data. */
export interface Quote {
  cost: number;
  remaining: number | string | null;
  rate_card: string;
}

export type Time = string | number;

export interface PageMeta {
  feed_type: string;
  region: string;
  odds_format: string;
  processed_at: Time;
  count: number;
  version: string;
  next_cursor: string | null;
}

export interface Page<T> {
  meta: PageMeta;
  data: T[];
}

export interface BackPrice {
  bookmaker: string | null;
  price: number | null;
  link: string | null;
  places?: number | null;
  place_fraction?: number | null;
  dutch_id?: string;
}

export interface LayPrice {
  exchange: string;
  price: number | null;
  available: number | null;
  link: string | null;
  places?: number | null;
}

export interface MatchedOutcome {
  name: string;
  point?: number;
  back: BackPrice[];
  /** Each-way boards split lay prices into win and place. */
  lay?: LayPrice[] | { win: LayPrice[]; place: LayPrice[] };
}

export interface MatchedEvent {
  event_id: string;
  sport_key: string;
  sport_title: string;
  commence_time: Time | null;
  home_team?: string | null;
  away_team?: string | null;
  event_name?: string;
  venue?: string | null;
  markets: { key: string; outcomes: MatchedOutcome[] }[];
}

export interface MatchedBoard {
  meta: PageMeta & { last_seen?: Record<string, Record<string, string>> };
  data: MatchedEvent[];
}

export interface RawOutcome {
  name: string;
  price?: number | null;
  back_price?: number | null;
  lay_price?: number | null;
  available?: number | null;
}

export interface RawEvent {
  id: string;
  cluster_id: string | null;
  sport_key: string;
  sport_title: string;
  commence_time: Time | null;
  home_team: string | null;
  away_team: string | null;
  bookmakers: {
    key: string;
    title: string;
    region: string;
    last_update: Time | null;
    link?: string;
    markets: { key: string; last_update: Time | null; outcomes: RawOutcome[] }[];
  }[];
}

export interface RawBoard {
  meta: PageMeta & { total: number; board_version: number | null };
  data: RawEvent[];
}

export interface Sport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
  regions: string[];
  markets: string[];
}

export interface Event {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: Time | null;
  home_team: string | null;
  away_team: string | null;
  status: string;
  has_coverage: string[];
}

export interface Venue {
  key: string;
  name: string;
  regions: string[];
  is_exchange: boolean;
}

export interface Catalogue {
  meta: { feed_type: string; count: number; version: string };
  data: Venue[];
}

export interface Regions {
  version: string;
  default_region: string;
  regions: {
    code: string;
    name: string;
    requestable: boolean;
    bookmakers: number;
    exchanges: string[];
    matched_coverage: boolean;
    coverage_model: string;
    exchange_available: boolean;
    board: string;
  }[];
}

/** Keyless coverage: which venue and sport pairs each product carries. */
export interface CoverageSummary {
  region: string;
  generated_at: string;
  products: Record<string, { bookmaker: string; sport: string; status: string }[]>;
  markets: Record<string, string[]>;
}

interface VenueCoverage {
  key: string;
  name: string;
  sports: Record<string, { events: number; last_seen?: string | null }>;
}

/** Coverage as a key sees it, with event counts per sport. */
export interface CoverageKeyed {
  region: string;
  generated_at: string;
  products: Record<string, { bookmakers: VenueCoverage[]; exchanges: VenueCoverage[] }>;
}

export type Coverage = CoverageSummary | CoverageKeyed;

export interface Status {
  region: string;
  generated_at: string;
  products: Record<string, string>;
}

export interface Health {
  status: string;
  version: string;
  boards: Record<string, { processed_at: string | null; age_s: number | null; count: number | null }>;
  stale_boards?: string[];
  max_board_age_s?: number;
  missing_boards?: string[];
}

export interface Usage {
  plan: string | null;
  rate_card: string;
  account: { status: string; suspension_reason: string | null; test: boolean | null };
  tokens: {
    used: number | null;
    remaining: number | string | null;
    limit: number | string | null;
    resets_at: string | null;
  };
  regions: string[];
  key: {
    id: string;
    kind: string;
    products: string[];
    regions: string[];
    token_cap: null;
    tokens_used: null;
  };
  flood_cap: { per_10s: number; per_min: number };
  scope: Record<string, unknown> | null;
  scope_version: number | null;
}

/** The token rate card. `regions` is kept loose: its inner shape varies by product. */
export interface PriceTable {
  rate_card: string;
  provisional?: boolean;
  captured_at?: string;
  recent: { max_age_s?: number; factor?: number };
  regions: Record<string, unknown>;
}

export interface OpenApiDocument {
  openapi: string;
  info: { version: string; [key: string]: unknown };
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

/** The token meter, read from the X-Tokens-* headers. Absent headers are undefined. */
export interface Tokens {
  cost?: number;
  used?: number;
  remaining?: number | "unlimited";
  limit?: number | "unlimited";
  /** When the pool resets, ISO 8601. */
  reset?: string;
}

/** The request rate window, read from the X-RateLimit-* headers. */
export interface RateLimit {
  limit?: number;
  remaining?: number;
  /** Seconds until the window ends. */
  reset?: number;
}

/** What every reply carries, data or not. */
export interface ResponseInfo {
  status: number;
  headers: Headers;
  requestId?: string;
  etag?: string;
  tokens: Tokens;
  rateLimit: RateLimit;
}

export interface Fresh<T> extends ResponseInfo {
  notModified: false;
  data: T;
}

/** A 304: the data has not changed since the ETag this client sent. No body. */
export interface NotModified extends ResponseInfo {
  notModified: true;
  data?: undefined;
}

export type Result<T> = Fresh<T> | NotModified;

/** `format: "bare"` returns the data array alone. A format only known at runtime gives either shape. */
export type Shaped<P, E extends { data: unknown }> = P extends { format: "bare" }
  ? E["data"]
  : "format" extends keyof P
    ? P extends { format: "envelope" }
      ? E
      : E | E["data"]
    : E;

/** `quote: true` returns a Quote instead of data. A quote flag only known at runtime gives either. */
export type Quoted<P, T> = P extends { quote: true }
  ? Quote
  : "quote" extends keyof P
    ? P extends { quote: false }
      ? T
      : T | Quote
    : T;
