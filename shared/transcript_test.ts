import { appendEvents, parseTranscript, toModelContext } from "./transcript.ts";
import { assertEquals } from "./test_assert.ts";
import type { TranscriptEvent } from "./types.ts";

Deno.test("transcript parsing skips invalid lines", () => {
  const transcript = [
    JSON.stringify({
      role: "user",
      characterId: "josef",
      characterName: "Josef",
      text: "hello",
      at: "2026-01-01T00:00:00.000Z",
    }),
    "not-json",
    JSON.stringify({ role: "user" }),
  ].join("\n");

  assertEquals(parseTranscript(transcript).length, 1);
});

Deno.test("appendEvents appends JSONL and model context is readable", () => {
  const event: TranscriptEvent = {
    role: "user",
    characterId: "josef",
    characterName: "Josef",
    text: "hello",
    at: "2026-01-01T00:00:00.000Z",
  };
  const transcript = appendEvents("", [event]);
  assertEquals(parseTranscript(transcript)[0].text, "hello");
  assertEquals(
    toModelContext([event]),
    "[2026-01-01T00:00:00.000Z] PLAYER -> Josef: hello",
  );
});
