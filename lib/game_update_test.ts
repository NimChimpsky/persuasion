import { parseGameUpdateDirective } from "./game_update.ts";
import { assertArrayEquals, assertEquals } from "../shared/test_assert.ts";

Deno.test("game update parser extracts clean text and directives", () => {
  const result = parseGameUpdateDirective(
    'Visible text<game_update>{"new_characters":[{"name":"New Person","bio":"Bio","definition":"Definition"}],"unlock_character_ids":["New Person"]}</game_update>',
  );

  assertEquals(result.cleanText, "Visible text");
  assertEquals(result.newCharacters.length, 1);
  assertEquals(result.newCharacters[0].name, "New Person");
  assertArrayEquals(result.unlockCharacterIds, ["new-person"]);
});

Deno.test("game update parser ignores malformed directive JSON", () => {
  const result = parseGameUpdateDirective(
    "Visible<game_update>{nope}</game_update>after",
  );

  assertEquals(result.cleanText, "Visible\n\nafter");
  assertEquals(result.newCharacters.length, 0);
  assertEquals(result.unlockCharacterIds.length, 0);
});
