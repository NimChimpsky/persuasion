import type { CharacterRef } from "./types.ts";

interface CharacterListProps {
  characters: CharacterRef[];
  activeCharacterId: string;
  encounteredSet: Set<string>;
  summaryByCharacterId: Map<string, string>;
  loading: boolean;
  hasPlaceholderSlot: boolean;
  onSelect: (characterId: string) => void;
}

export default function CharacterList(
  {
    characters,
    activeCharacterId,
    encounteredSet,
    summaryByCharacterId,
    loading,
    hasPlaceholderSlot,
    onSelect,
  }: CharacterListProps,
) {
  return (
    <aside class="game-characters">
      <div class="character-panel">
        <p class="character-panel-title">Select character to talk to</p>
        <div class="character-grid">
          {characters.map((character) => {
            const encountered = encounteredSet.has(character.id.toLowerCase());
            const isActive = character.id === activeCharacterId;
            return (
              <button
                key={character.id}
                type="button"
                class={`card character-summary ${
                  isActive ? "is-active" : "is-inactive"
                }`}
                data-encountered={encountered ? "true" : "false"}
                disabled={loading}
                onClick={() => {
                  if (loading) return;
                  onSelect(character.id);
                }}
              >
                <h4>{character.name}</h4>
                <p>
                  {summaryByCharacterId.get(character.id) ??
                    "No conversation yet"}
                </p>
              </button>
            );
          })}
          {hasPlaceholderSlot
            ? (
              <div class="card character-placeholder">
                Select a character to chat
              </div>
            )
            : null}
        </div>
      </div>
    </aside>
  );
}
