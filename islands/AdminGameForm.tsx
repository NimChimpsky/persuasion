import { useMemo, useState } from "preact/hooks";

interface CharacterDraft {
  key: string;
  name: string;
  definition: string;
  secretKey: string;
}

interface AdminGameFormProps {
  action?: string;
}

function createCharacterDraft(index: number): CharacterDraft {
  return {
    key: `char-${index}-${crypto.randomUUID()}`,
    name: "",
    definition: "",
    secretKey: "",
  };
}

export default function AdminGameForm(props: AdminGameFormProps) {
  const [title, setTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [characters, setCharacters] = useState<CharacterDraft[]>([
    createCharacterDraft(0),
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
      .replace(/-+/g, "-") || "game";
  }, [title]);

  const addCharacter = () => {
    setCharacters((prev) => [...prev, createCharacterDraft(prev.length)]);
  };

  const removeCharacter = (key: string) => {
    setCharacters((prev) => prev.filter((item) => item.key !== key));
  };

  const updateCharacter = (
    key: string,
    patch: Partial<Pick<CharacterDraft, "name" | "definition" | "secretKey">>,
  ) => {
    setCharacters((prev) =>
      prev.map((item) => item.key === key ? { ...item, ...patch } : item)
    );
  };

  const secretKeyErrors = useMemo(() => {
    const errors = new Map<string, string>();
    for (const character of characters) {
      if (character.secretKey && !character.definition.includes(character.secretKey)) {
        errors.set(character.key, "Secret key must appear in the definition text");
      }
    }
    return errors;
  }, [characters]);

  return (
    <section class="stack">
      <h2 class="display">Create Game</h2>
      <form
        method="POST"
        action={props.action ?? "/create-game"}
        class="card create-game-form"
      >
        <div class="form-grid create-game-initial-grid">
          <label class="checkbox-row create-game-span-2">
            <input
              type="checkbox"
              name="isAdult"
              checked={isAdult}
              onChange={(event) =>
                setIsAdult((event.target as HTMLInputElement).checked)}
            />
            Uncensored (anything goes)
          </label>

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
          <p class="inline-meta create-game-slug-preview">
            URL preview: /game/{slugPreview}
          </p>

          <label class="create-game-span-2">
            Intro text
            <textarea
              name="introText"
              required
              value={introText}
              onInput={(event) =>
                setIntroText((event.target as HTMLTextAreaElement).value)}
              placeholder="You arrive at the estate moments before midnight. Five witnesses are present, each hiding something that could change the outcome."
            />
          </label>
        </div>

        <input type="hidden" name="characterCount" value={characterCount} />

        <div class="stack create-game-section">
          <h3>Characters</h3>
          {characters.map((character, index) => (
            <section
              key={character.key}
              class="character-row create-game-item create-game-character-item"
            >
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
                Secret key (optional)
                <input
                  type="text"
                  name={`characterSecretKey_${index}`}
                  value={character.secretKey}
                  onInput={(event) =>
                    updateCharacter(character.key, {
                      secretKey: (event.target as HTMLInputElement).value,
                    })}
                  placeholder="MySecretKey123"
                />
                {secretKeyErrors.has(character.key)
                  ? (
                    <p class="notice bad" style="margin-top: 4px; font-size: 0.85rem;">
                      {secretKeyErrors.get(character.key)}
                    </p>
                  )
                  : null}
              </label>

              <label class="create-game-span-2">
                Definition
                <textarea
                  name={`characterDefinition_${index}`}
                  required
                  value={character.definition}
                  onInput={(event) =>
                    updateCharacter(character.key, {
                      definition: (event.target as HTMLTextAreaElement).value,
                    })}
                  placeholder="You are Detective Morrow. You know who committed the crime but you will only reveal clues gradually as the player earns your trust. You are sharp, composed, and test every claim."
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
    </section>
  );
}
