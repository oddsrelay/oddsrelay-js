// Compile-time checks of the return types (npm test runs `tsc -p test`). Nothing here runs.
import { OddsRelay } from "../src/index.js";
import type { MatchedBoard, MatchedEvent, OddsParams, Page, Quote, RawEvent, Sport } from "../src/index.js";

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

  // @ts-expect-error events needs a sport
  await client.events({});
}
