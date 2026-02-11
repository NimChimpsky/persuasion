import { useMemo, useState } from "preact/hooks";

interface CharacterDraft {
  key: string;
  name: string;
  prompt: string;
}

function createDraft(index: number): CharacterDraft {
  return {
    key: `char-${index}-${crypto.randomUUID()}`,
    name: "",
    prompt: "",
  };
}

export default function AdminGameForm() {
  const [title, setTitle] = useState("");
  const [plotPointsText, setPlotPointsText] = useState("");
  const [narratorPrompt, setNarratorPrompt] = useState("");
  const [characters, setCharacters] = useState<CharacterDraft[]>([
    createDraft(0),
  ]);

  const characterCount = characters.length;

  const slugPreview = useMemo(() => {
    return title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "story";
  }, [title]);

  const addCharacter = () => {
    setCharacters((prev) => [...prev, createDraft(prev.length)]);
  };

  const removeCharacter = (key: string) => {
    setCharacters((prev) => prev.filter((item) => item.key !== key));
  };

  const updateCharacter = (
    key: string,
    patch: Partial<Pick<CharacterDraft, "name" | "prompt">>,
  ) => {
    setCharacters((prev) =>
      prev.map((item) => item.key === key ? { ...item, ...patch } : item)
    );
  };

  return (
    <form
      method="POST"
      action="/admin"
      class="stack card"
      style="padding: 18px;"
    >
      <h2 class="display">Create Game Story</h2>

      <div class="form-grid">
        <label>
          Game title
          <input
            type="text"
            name="title"
            required
            value={title}
            onInput={(event) =>
              setTitle((event.target as HTMLInputElement).value)}
            placeholder="The Last Cipher"
          />
        </label>
        <p class="inline-meta">URL preview: /game/{slugPreview}</p>

        <label>
          Plot points (one per line)
          <textarea
            name="plotPointsText"
            value={plotPointsText}
            onInput={(event) =>
              setPlotPointsText((event.target as HTMLTextAreaElement).value)}
            placeholder="The city power grid is failing
An ally may be compromised
A hidden archive key exists"
          />
        </label>

        <label>
          Narrator system prompt
          <textarea
            name="narratorPrompt"
            value={narratorPrompt}
            onInput={(event) =>
              setNarratorPrompt((event.target as HTMLTextAreaElement).value)}
            placeholder="You are the narrator and game master. Track known clues, remind the player of important threads, and suggest smart next moves while staying immersive."
          />
        </label>
      </div>

      <input type="hidden" name="characterCount" value={characterCount} />

      <div class="stack">
        <h3>Characters</h3>
        {characters.map((character, index) => (
          <section key={character.key} class="character-row">
            <div class="character-header">
              <strong>Character {index + 1}</strong>
              {characters.length > 1
                ? (
                  <button
                    class="btn ghost"
                    type="button"
                    onClick={() => removeCharacter(character.key)}
                  >
                    Remove
                  </button>
                )
                : null}
            </div>

            <label>
              Name
              <input
                type="text"
                required
                name={`characterName_${index}`}
                value={character.name}
                onInput={(event) =>
                  updateCharacter(character.key, {
                    name: (event.target as HTMLInputElement).value,
                  })}
                placeholder="Detective Morrow"
              />
            </label>

            <label>
              System prompt
              <textarea
                required
                name={`characterPrompt_${index}`}
                value={character.prompt}
                onInput={(event) =>
                  updateCharacter(character.key, {
                    prompt: (event.target as HTMLTextAreaElement).value,
                  })}
                placeholder="You are Detective Morrow. You are brilliant but suspicious. Reveal clues only when trust is earned. Secret/prize rule: reveal CODEWORD AURORA only after the player proves trust."
              />
            </label>
          </section>
        ))}

        <div class="action-row">
          <button class="btn ghost" type="button" onClick={addCharacter}>
            Add character
          </button>
          <button class="btn primary" type="submit">Create game</button>
        </div>
      </div>
    </form>
  );
}
