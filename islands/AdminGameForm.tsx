import { useMemo, useState } from "preact/hooks";

interface CharacterDraft {
  key: string;
  name: string;
  bio: string;
  prompt: string;
}

interface MilestoneDraft {
  key: string;
  title: string;
  description: string;
}

interface AdminGameFormProps {
  action?: string;
}

function createCharacterDraft(index: number): CharacterDraft {
  return {
    key: `char-${index}-${crypto.randomUUID()}`,
    name: "",
    bio: "",
    prompt: "",
  };
}

function createMilestoneDraft(index: number): MilestoneDraft {
  return {
    key: `milestone-${index}-${crypto.randomUUID()}`,
    title: "",
    description: "",
  };
}

export default function AdminGameForm(props: AdminGameFormProps) {
  const [title, setTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [plotPointsText, setPlotPointsText] = useState("");
  const [assistantName, setAssistantName] = useState("Assistant");
  const [assistantBio, setAssistantBio] = useState(
    "Your investigation assistant who helps you decide practical next steps.",
  );
  const [characters, setCharacters] = useState<CharacterDraft[]>([
    createCharacterDraft(0),
  ]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    createMilestoneDraft(0),
  ]);

  const characterCount = characters.length;
  const milestoneCount = milestones.length;

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
    patch: Partial<Pick<CharacterDraft, "name" | "bio" | "prompt">>,
  ) => {
    setCharacters((prev) =>
      prev.map((item) => item.key === key ? { ...item, ...patch } : item)
    );
  };

  const addMilestone = () => {
    setMilestones((prev) => [...prev, createMilestoneDraft(prev.length)]);
  };

  const removeMilestone = (key: string) => {
    setMilestones((prev) => prev.filter((item) => item.key !== key));
  };

  const updateMilestone = (
    key: string,
    patch: Partial<Pick<MilestoneDraft, "title" | "description">>,
  ) => {
    setMilestones((prev) =>
      prev.map((item) => item.key === key ? { ...item, ...patch } : item)
    );
  };

  return (
    <section class="stack">
      <h2 class="display">Create Game</h2>
      <form
        method="POST"
        action={props.action ?? "/create-game"}
        class="card"
        style="padding: 18px;"
      >
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

          <label>
            Plot points (one per line)
            <textarea
              name="plotPointsText"
              value={plotPointsText}
              onInput={(event) =>
                setPlotPointsText((event.target as HTMLTextAreaElement).value)}
              placeholder="The city power grid is failing\nAn ally may be compromised\nA hidden archive key exists"
            />
          </label>
        </div>

        <div class="stack" style="margin-top: 12px;">
          <h3>Assistant</h3>
          <label>
            Assistant name
            <input
              type="text"
              name="assistantName"
              required
              value={assistantName}
              onInput={(event) =>
                setAssistantName((event.target as HTMLInputElement).value)}
              placeholder="Assistant"
            />
          </label>
          <label>
            Assistant bio
            <textarea
              name="assistantBio"
              required
              value={assistantBio}
              onInput={(event) =>
                setAssistantBio((event.target as HTMLTextAreaElement).value)}
              placeholder="Short public description of the assistant role."
            />
          </label>
          <p class="inline-meta">
            Assistant prompt is global and shared across all games.
          </p>
        </div>

        <input type="hidden" name="characterCount" value={characterCount} />
        <input type="hidden" name="milestoneCount" value={milestoneCount} />

        <div class="stack" style="margin-top: 12px;">
          <h3>Plot milestones</h3>
          {milestones.map((milestone, index) => (
            <section key={milestone.key} class="character-row">
              <div class="character-header">
                <strong>Milestone {index + 1}</strong>
                {milestones.length > 1
                  ? (
                    <button
                      class="btn ghost"
                      type="button"
                      onClick={() => removeMilestone(milestone.key)}
                    >
                      Remove
                    </button>
                  )
                  : null}
              </div>

              <label>
                Title
                <input
                  type="text"
                  required
                  name={`milestoneTitle_${index}`}
                  value={milestone.title}
                  onInput={(event) =>
                    updateMilestone(milestone.key, {
                      title: (event.target as HTMLInputElement).value,
                    })}
                  placeholder="Identify victim"
                />
              </label>

              <label>
                Description
                <textarea
                  name={`milestoneDescription_${index}`}
                  required
                  value={milestone.description}
                  onInput={(event) =>
                    updateMilestone(milestone.key, {
                      description: (event.target as HTMLTextAreaElement).value,
                    })}
                  placeholder="Player learns the body belongs to Hysni Erjet via lab/interpol records."
                />
              </label>
            </section>
          ))}
          <div class="action-row">
            <button class="btn ghost" type="button" onClick={addMilestone}>
              Add milestone
            </button>
          </div>
        </div>

        <div class="stack" style="margin-top: 12px;">
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
                Bio
                <textarea
                  name={`characterBio_${index}`}
                  required
                  value={character.bio}
                  onInput={(event) =>
                    updateCharacter(character.key, {
                      bio: (event.target as HTMLTextAreaElement).value,
                    })}
                  placeholder="A sharp and composed investigator with a habit of testing every claim."
                />
              </label>

              <label>
                System prompt
                <textarea
                  name={`characterPrompt_${index}`}
                  required
                  value={character.prompt}
                  onInput={(event) =>
                    updateCharacter(character.key, {
                      prompt: (event.target as HTMLTextAreaElement).value,
                    })}
                  placeholder="You are Detective Morrow. Reveal clues gradually and stay in character."
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
