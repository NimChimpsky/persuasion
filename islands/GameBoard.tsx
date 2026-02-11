import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { NARRATOR_ID, NARRATOR_NAME } from "../shared/narrator.ts";
import type { SidePane, TranscriptEvent } from "../shared/types.ts";

interface CharacterRef {
  id: string;
  name: string;
}

interface GameBoardProps {
  slug: string;
  characters: CharacterRef[];
  initialEvents: TranscriptEvent[];
  initialSidePanes: SidePane[];
}

interface MentionState {
  query: string;
  atIndex: number;
  cursor: number;
}

interface ApiResponse {
  ok: boolean;
  events?: TranscriptEvent[];
  sidePanes?: SidePane[];
  error?: string;
}

const NARRATOR_REF: CharacterRef = {
  id: NARRATOR_ID,
  name: NARRATOR_NAME,
};

function parseMention(text: string, cursor: number): MentionState | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([a-z0-9_-]*)$/i);
  if (!match) return null;

  const query = match[1].toLowerCase();
  const atIndex = before.length - query.length - 1;
  return { query, atIndex, cursor };
}

function findTargetCharacterId(
  text: string,
  available: CharacterRef[],
): string | null {
  const mention = text.match(/@([a-z0-9_-]+)/i);
  if (!mention) return null;
  const candidate = mention[1].toLowerCase();
  const found = available.find((item) => item.id.toLowerCase() === candidate);
  return found?.id ?? null;
}

function stripMentions(input: string): string {
  return input.replace(/@[a-z0-9_-]+/gi, "").replace(/\s+/g, " ").trim();
}

export default function GameBoard(props: GameBoardProps) {
  const [events, setEvents] = useState<TranscriptEvent[]>(props.initialEvents);
  const [sidePanes, setSidePanes] = useState<SidePane[]>(
    props.initialSidePanes,
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(0);

  const mention = useMemo(() => parseMention(draft, cursor), [draft, cursor]);
  const mentionableCharacters = useMemo(
    () => [NARRATOR_REF, ...props.characters],
    [props.characters],
  );

  const filteredCharacters = useMemo(() => {
    if (!mention) return [];
    return mentionableCharacters.filter((character) => {
      if (!mention.query) return true;
      return character.id.includes(mention.query) ||
        character.name.toLowerCase().includes(mention.query);
    });
  }, [mention, mentionableCharacters]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  const applyMention = (character: CharacterRef) => {
    if (!mention) return;

    const beforeAt = draft.slice(0, mention.atIndex);
    const afterCursor = draft.slice(mention.cursor);
    const nextValue = `${beforeAt}@${character.id} ${afterCursor}`;

    setDraft(nextValue);
    setCursor((beforeAt + `@${character.id} `).length);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const position = (beforeAt + `@${character.id} `).length;
      textarea.focus();
      textarea.selectionStart = position;
      textarea.selectionEnd = position;
    });
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();

    if (loading) return;

    const targetCharacterId = findTargetCharacterId(
      draft,
      mentionableCharacters,
    );

    const userText = stripMentions(draft);
    if (!userText) {
      setError("Enter a prompt to continue the story.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/games/${props.slug}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: userText,
          targetCharacterId,
        }),
      });

      const payload = await response.json() as ApiResponse;
      if (
        !response.ok || !payload.ok || !payload.events || !payload.sidePanes
      ) {
        throw new Error(payload.error || "Unable to send message");
      }

      setEvents((prev) => [...prev, ...payload.events!]);
      setSidePanes(payload.sidePanes!);
      setDraft("");
      setCursor(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  let sideIndex = 0;

  return (
    <section class="game-board">
      {Array.from({ length: 9 }).map((_, index) => {
        if (index === 4) {
          return (
            <article key="center" class="card board-pane board-center">
              <div class="chat-shell">
                <div class="messages" ref={messagesRef}>
                  {events.length === 0
                    ? (
                      <p class="notice">
                        Start the scene by typing normally for the narrator, or
                        mention a character like @{props.characters[0]?.id ??
                          NARRATOR_ID}.
                      </p>
                    )
                    : null}

                  {events.map((item, itemIndex) => (
                    <div
                      class={`message ${
                        item.role === "user" ? "user" : "character"
                      }`}
                      key={`${item.at}-${itemIndex}`}
                    >
                      <p class="message-meta">
                        {item.role === "user"
                          ? `You -> ${item.characterName}`
                          : item.characterName}
                      </p>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>

                <form class="composer" onSubmit={onSubmit}>
                  {mention && filteredCharacters.length > 0
                    ? (
                      <div class="mention-list">
                        {filteredCharacters.map((character) => (
                          <button
                            key={character.id}
                            type="button"
                            class="mention-item"
                            onClick={() => applyMention(character)}
                          >
                            @{character.id} · {character.name}
                          </button>
                        ))}
                      </div>
                    )
                    : null}

                  <textarea
                    ref={textareaRef}
                    value={draft}
                    placeholder="Type your message (or @character to direct someone specific)..."
                    onInput={(event) => {
                      const value = (event.target as HTMLTextAreaElement).value;
                      setDraft(value);
                    }}
                    onKeyUp={(event) => {
                      const target = event.currentTarget as HTMLTextAreaElement;
                      setCursor(target.selectionStart || 0);
                    }}
                    onClick={(event) => {
                      const target = event.currentTarget as HTMLTextAreaElement;
                      setCursor(target.selectionStart || 0);
                    }}
                  />

                  <button class="btn primary" type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send"}
                  </button>
                </form>
              </div>
              {error
                ? <p class="notice bad" style="margin: 8px;">{error}</p>
                : null}
            </article>
          );
        }

        const pane = sidePanes[sideIndex] ?? {
          title: `Panel ${sideIndex + 1}`,
          body: "Placeholder",
          kind: "plot" as const,
        };
        sideIndex++;

        return (
          <article key={`side-${index}`} class="card board-pane">
            <h3>{pane.title}</h3>
            <p>{pane.body}</p>
          </article>
        );
      })}
    </section>
  );
}
