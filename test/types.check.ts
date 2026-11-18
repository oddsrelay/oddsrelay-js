// Compile-time checks of the return types (npm test runs `tsc -p test`). Nothing here runs.
import { OddsRelay } from "../src/index.js";
import type { EventStates, HistoryFile, HistoryPage, MatchedBoard, MatchedEvent, OddsParams, Page, Quote, RawEvent, Sport } from "../src/index.js";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const expect = <T extends true>() => {};

export async function checks(client: OddsRelay, dynamic: OddsParams) {
  const board = await client.odds("standard");
  if (!board.notModified) expect<Equal<typeof board.data, MatchedBoard>>();

  const bare = await client.odds("standard", { region: "uk", format: "bare" });
  if (!bare.notModified) expect<Equal<typeof bare.data, MatchedEvent[]>>();

  const quote = await client.odds("standard", { sports: ["soccer"], quote: true });
  if (!quote.notModified) expect<Equal<typeof quote.data, Quote>>();

  const either = await client.odds("standard", dynamic);
  if (!either.notModified) expect<Equal<typeof either.data, MatchedBoard | MatchedEvent[] | Quote>>();

  const event = await client.event("or_evt_1", { region: "uk" });
  if (!event.notModified) expect<Equal<typeof event.data, RawEvent>>();

  const sports = await client.sports();
  if (!sports.notModified) expect<Equal<typeof sports.data, Page<Sport>>>();

  const text = await client.healthz();
  if (!text.notModified) expect<Equal<typeof text.data, string>>();

  const states = await client.eventsState({ region: "us" });
  if (!states.notModified) expect<Equal<typeof states.data, EventStates>>();

  const past = await client.historyRaw({ date: "2026-11-16T12:00:00Z", sports: "soccer", region: ["us"][0] });
  if (!past.notModified) expect<Equal<typeof past.data, HistoryPage<RawEvent>>>();

  const files = await client.historyFiles();
  if (!files.notModified) expect<Equal<typeof files.data, HistoryPage<HistoryFile>>>();

  const file = await client.downloadFile("closing", "soccer", "2026-11-16.csv.gz");
  if (!file.notModified) expect<Equal<typeof file.data, Uint8Array>>();

  const price = await client.downloadFile("closing", "soccer", "2026-11-16.csv.gz", { quote: true });
  if (!price.notModified) expect<Equal<typeof price.data, Quote>>();

  await client.raw({ region: ["us", "global"], inPlay: "only" });

  // @ts-expect-error a history snapshot needs a date
  await client.historyRaw({ sports: "soccer" });

  // @ts-expect-error events needs a sport
  await client.events({});
}
