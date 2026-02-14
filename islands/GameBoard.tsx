import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { NARRATOR_ID, NARRATOR_NAME } from "../shared/narrator.ts";
import type { TranscriptEvent } from "../shared/types.ts";

interface CharacterRef {
  id: string;
  name: string;
  bio: string;
}

interface GameBoardProps {
  slug: string;
  characters: CharacterRef[];
  initialEvents: TranscriptEvent[];
  initialEncounteredCharacterIds: string[];
}

interface MentionState {
  query: string;
  atIndex: number;
  cursor: number;
}

interface JsonErrorResponse {
  ok?: boolean;
  error?: string;
}

interface StreamAckPayload {
  userEvent: TranscriptEvent;
  character: { id: string; name: string };
}

interface StreamDeltaPayload {
  text: string;
}

interface StreamFinalPayload {
  characterEvent: TranscriptEvent;
  characters: CharacterRef[];
  encounteredCharacterIds: string[];
}

interface StreamErrorPayload {
  error?: string;
}

const NARRATOR_REF: CharacterRef = {
  id: NARRATOR_ID,
  name: NARRATOR_NAME,
  bio: "Keeps track of clues and suggests strong next moves.",
};

function renderInlineAsterisk(text: string) {
  const parts = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`strong-${tokenIndex}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      parts.push(<em key={`em-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    }
    tokenIndex++;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderMessageText(text: string) {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const renderedLine = renderInlineAsterisk(line);
    if (index === lines.length - 1) return [renderedLine];
    return [renderedLine, <br key={`br-${index}`} />];
  });
}

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

async function consumeSseStream(
  response: Response,
  onEvent: (eventName: string, data: string) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("No stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (!dataLines.length) {
      currentEvent = "message";
      return;
    }
    onEvent(currentEvent, dataLines.join("\n"));
    currentEvent = "message";
    dataLines = [];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, "");

      if (line === "") {
        dispatch();
      } else if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    dataLines.push(trailing.slice(5).trimStart());
  }
  dispatch();
}

export default function GameBoard(props: GameBoardProps) {
  const [events, setEvents] = useState<TranscriptEvent[]>(props.initialEvents);
  const [characters, setCharacters] = useState<CharacterRef[]>(
    props.characters,
  );
  const [encounteredCharacterIds, setEncounteredCharacterIds] = useState<
    string[]
  >(props.initialEncounteredCharacterIds);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCharacterName, setStreamingCharacterName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(0);

  const mention = useMemo(() => parseMention(draft, cursor), [draft, cursor]);
  const mentionableCharacters = useMemo(
    () => [NARRATOR_REF, ...characters],
    [characters],
  );

  const filteredCharacters = useMemo(() => {
    if (!mention) return [];
    return mentionableCharacters.filter((character) => {
      if (!mention.query) return true;
      return character.id.includes(mention.query) ||
        character.name.toLowerCase().includes(mention.query);
    });
  }, [mention, mentionableCharacters]);

  const encounteredSet = useMemo(
    () => new Set(encounteredCharacterIds.map((id) => id.toLowerCase())),
    [encounteredCharacterIds],
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events, streamingText]);

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
      setError("Enter a prompt to continue the game.");
      return;
    }

    setError("");
    setLoading(true);
    setStreamingText("");
    setStreamingCharacterName("");

    try {
      const response = await fetch(`/api/games/${props.slug}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          targetCharacterId,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/event-stream")) {
        const payload = await response.json() as JsonErrorResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Unable to send message");
        }
        throw new Error("Unexpected non-stream response payload");
      }

      let sawFinal = false;

      await consumeSseStream(response, (eventName, data) => {
        const parsed = data ? JSON.parse(data) as unknown : {};

        if (eventName === "ack") {
          const payload = parsed as StreamAckPayload;
          if (!payload.userEvent || !payload.character?.name) {
            throw new Error("Malformed stream ack event");
          }
          setEvents((prev) => [...prev, payload.userEvent]);
          setStreamingCharacterName(payload.character.name);
          setDraft("");
          setCursor(0);
          return;
        }

        if (eventName === "delta") {
          const payload = parsed as StreamDeltaPayload;
          if (payload.text) {
            setStreamingText((prev) => `${prev}${payload.text}`);
          }
          return;
        }

        if (eventName === "final") {
          const payload = parsed as StreamFinalPayload;
          if (
            !payload.characterEvent || !payload.characters ||
            !payload.encounteredCharacterIds
          ) {
            throw new Error("Malformed stream final event");
          }
          setEvents((prev) => [...prev, payload.characterEvent]);
          setCharacters(payload.characters);
          setEncounteredCharacterIds(payload.encounteredCharacterIds);
          setStreamingText("");
          setStreamingCharacterName("");
          sawFinal = true;
          return;
        }

        if (eventName === "error") {
          const payload = parsed as StreamErrorPayload;
          throw new Error(payload.error || "Unable to complete message stream");
        }
      });

      if (!sawFinal) {
        throw new Error("Stream ended before final message");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setStreamingText("");
      setStreamingCharacterName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section class="game-layout">
      <aside class="game-characters">
        <h3>Characters</h3>
        <div class="character-grid">
          {characters.map((character) => {
            const encountered = encounteredSet.has(character.id.toLowerCase());
            return (
              <article
                key={character.id}
                class={`card character-summary ${
                  encountered ? "" : "is-blurred"
                }`}
              >
                <p class="character-id">@{character.id}</p>
                <h4>{character.name}</h4>
                <p>{character.bio}</p>
              </article>
            );
          })}
        </div>
      </aside>

      <article class="card chat-panel">
        <div class="chat-shell">
          <div class="messages" ref={messagesRef}>
            {events.length === 0
              ? (
                <p class="notice">
                  Start by talking to the narrator, or mention a character like
                  {" "}
                  @{characters[0]?.id ?? NARRATOR_ID}.
                </p>
              )
              : null}

            {events.map((item, itemIndex) => (
              <div
                class={`message ${item.role === "user" ? "user" : "character"}`}
                key={`${item.at}-${itemIndex}`}
              >
                <p class="message-meta">
                  {item.role === "user"
                    ? `You -> ${item.characterName}`
                    : item.characterName}
                </p>
                <p class="message-body">{renderMessageText(item.text)}</p>
              </div>
            ))}

            {loading && streamingCharacterName
              ? (
                <div class="message character is-streaming">
                  <p class="message-meta">{streamingCharacterName}</p>
                  <p class="message-body">
                    {streamingText ? renderMessageText(streamingText) : "..."}
                  </p>
                </div>
              )
              : null}
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
              placeholder="Message the narrator, or type @character to direct someone specific..."
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
        {error ? <p class="notice bad" style="margin: 8px;">{error}</p> : null}
      </article>
    </section>
  );
}
