import { useEffect, useMemo, useRef, useState } from "preact/hooks";
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

function pickInitialCharacterId(
  characters: CharacterRef[],
  encounteredCharacterIds: string[],
): string {
  if (characters.length === 0) return "";
  const encountered = new Set(
    encounteredCharacterIds.map((id) => id.toLowerCase()),
  );
  const firstEncountered = characters.find((character) =>
    encountered.has(character.id.toLowerCase())
  );
  return firstEncountered?.id ?? characters[0].id;
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
  const [activeCharacterId, setActiveCharacterId] = useState<string>(() =>
    pickInitialCharacterId(
      props.characters,
      props.initialEncounteredCharacterIds,
    )
  );
  const [streamingText, setStreamingText] = useState("");
  const [streamingCharacterName, setStreamingCharacterName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const encounteredSet = useMemo(
    () => new Set(encounteredCharacterIds.map((id) => id.toLowerCase())),
    [encounteredCharacterIds],
  );
  const activeCharacter = useMemo(
    () =>
      characters.find((character) => character.id === activeCharacterId) ??
        null,
    [characters, activeCharacterId],
  );

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events, streamingText]);

  useEffect(() => {
    if (
      activeCharacterId && characters.some((c) => c.id === activeCharacterId)
    ) {
      return;
    }
    setActiveCharacterId(
      pickInitialCharacterId(characters, encounteredCharacterIds),
    );
  }, [characters, encounteredCharacterIds, activeCharacterId]);

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (loading) return;

    const userText = draft.trim();
    if (!userText) {
      setError("Enter a prompt to continue the game.");
      return;
    }
    if (!activeCharacter) {
      setError("Select a character first.");
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
          characterId: activeCharacter.id,
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
          requestAnimationFrame(() => {
            textareaRef.current?.focus();
          });
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
            const isActive = character.id === activeCharacterId;
            return (
              <button
                key={character.id}
                type="button"
                class={`card character-summary ${
                  isActive ? "is-active" : "is-inactive"
                } ${encountered ? "" : "is-blurred"}`}
                onClick={() => setActiveCharacterId(character.id)}
              >
                <p class="character-id">{character.id}</p>
                <h4>{character.name}</h4>
                <p>{character.bio}</p>
              </button>
            );
          })}
        </div>
      </aside>

      <article class="card chat-panel">
        <div class="chat-shell">
          <div class="chat-header">
            <strong>
              {activeCharacter
                ? `Talking to ${activeCharacter.name}`
                : "Select a character"}
            </strong>
          </div>

          <div class="messages" ref={messagesRef}>
            {events.length === 0
              ? (
                <p class="notice">
                  Select a character on the left and send your first message.
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
            <textarea
              ref={textareaRef}
              value={draft}
              placeholder={activeCharacter
                ? `Message ${activeCharacter.name}...`
                : "Select a character first..."}
              disabled={!activeCharacter}
              onInput={(event) => {
                const value = (event.target as HTMLTextAreaElement).value;
                setDraft(value);
              }}
            />

            <button
              class="btn primary send-btn"
              type="submit"
              disabled={loading || !activeCharacter}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
        {error ? <p class="notice bad" style="margin: 8px;">{error}</p> : null}
      </article>
    </section>
  );
}
