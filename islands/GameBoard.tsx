import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  PlotMilestone,
  ProgressState,
  TranscriptEvent,
} from "../shared/types.ts";

interface CharacterRef {
  id: string;
  name: string;
  bio: string;
}

interface GameBoardProps {
  slug: string;
  introText: string;
  characters: CharacterRef[];
  initialEvents: TranscriptEvent[];
  initialEncounteredCharacterIds: string[];
  initialAssistantId: string;
  initialProgressState: ProgressState;
  initialPlotMilestones: PlotMilestone[];
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
  progressState?: ProgressState;
  discoveredMilestoneIds?: string[];
  assistantId?: string;
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

function toSummaryText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const max = 96;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
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
  const [streamingCharacterId, setStreamingCharacterId] = useState("");
  const [progressState, setProgressState] = useState<ProgressState>(
    props.initialProgressState,
  );
  const [plotMilestones] = useState<PlotMilestone[]>(
    props.initialPlotMilestones,
  );
  const [desktopBoardHeight, setDesktopBoardHeight] = useState<number | null>(
    null,
  );
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const layoutRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const discoveredSet = useMemo(
    () =>
      new Set(
        progressState.discoveredMilestoneIds.map((id) => id.toLowerCase()),
      ),
    [progressState.discoveredMilestoneIds],
  );
  const discoveredCount = useMemo(
    () =>
      plotMilestones.filter((milestone) =>
        discoveredSet.has(milestone.id.toLowerCase())
      ).length,
    [plotMilestones, discoveredSet],
  );

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
  const visibleEvents = useMemo(() => {
    if (!activeCharacterId) return [];
    return events.filter((item) => item.characterId === activeCharacterId);
  }, [events, activeCharacterId]);
  const hasPlaceholderSlot = isDesktopLayout && characters.length % 2 === 1;
  const layoutStyle = desktopBoardHeight
    ? `height: ${desktopBoardHeight}px;`
    : undefined;
  const summaryByCharacterId = useMemo(() => {
    const map = new Map<string, string>();
    for (const character of characters) {
      const relatedEvents = events.filter((event) =>
        event.characterId === character.id
      );
      if (relatedEvents.length === 0) {
        map.set(character.id, "No conversation yet");
        continue;
      }

      const latestCharacterEvent = [...relatedEvents].reverse().find((event) =>
        event.role === "character"
      );
      const latestEvent = latestCharacterEvent ??
        relatedEvents[relatedEvents.length - 1];
      const summary = toSummaryText(latestEvent.text);
      map.set(character.id, summary || "No conversation yet");
    }
    return map;
  }, [characters, events]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleEvents, streamingText, activeCharacterId]);

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

  useEffect(() => {
    const host = globalThis;
    const recalc = () => {
      const desktop = host.matchMedia("(min-width: 981px)").matches;
      setIsDesktopLayout(desktop);

      if (!desktop) {
        setDesktopBoardHeight(null);
        return;
      }

      const layout = layoutRef.current;
      if (!layout) return;

      const rect = layout.getBoundingClientRect();
      const bottomPadding = 8;
      const next = Math.max(
        360,
        Math.floor(host.innerHeight - rect.top - bottomPadding),
      );
      setDesktopBoardHeight(next);
    };

    const run = () => host.requestAnimationFrame(recalc);
    run();
    host.addEventListener("resize", run);

    return () => {
      host.removeEventListener("resize", run);
    };
  }, [characters.length]);

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
          if (
            !payload.userEvent || !payload.character?.name ||
            !payload.character?.id
          ) {
            throw new Error("Malformed stream ack event");
          }
          setEvents((prev) => [...prev, payload.userEvent]);
          setStreamingCharacterName(payload.character.name);
          setStreamingCharacterId(payload.character.id);
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
          if (payload.progressState) {
            setProgressState(payload.progressState);
          }
          if (
            Array.isArray(payload.discoveredMilestoneIds) &&
            payload.progressState
          ) {
            setProgressState({
              ...payload.progressState,
              discoveredMilestoneIds: payload.discoveredMilestoneIds,
            });
          }
          setStreamingText("");
          setStreamingCharacterName("");
          setStreamingCharacterId("");
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
      setStreamingCharacterId("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section class="game-layout" ref={layoutRef} style={layoutStyle}>
      <aside class="game-characters">
        <div class="character-panel">
          <section class="card character-intro">
            <p>{props.introText}</p>
          </section>
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
                    setActiveCharacterId(character.id);
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

      <article class="card chat-panel">
        <div class="chat-shell">
          <div class="chat-header">
            <strong>
              {activeCharacter
                ? `Talking to ${activeCharacter.name}`
                : "Select a character"}
            </strong>
            <span class="inline-meta">
              {`Milestones ${discoveredCount}/${plotMilestones.length}`}
            </span>
          </div>

          <div class="messages" ref={messagesRef}>
            {visibleEvents.length === 0 &&
                !(loading && streamingCharacterId === activeCharacterId)
              ? (
                <p class="notice">
                  Select a character on the left and send your first message.
                </p>
              )
              : null}

            {visibleEvents.map((item, itemIndex) => (
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

            {loading && streamingCharacterName &&
                streamingCharacterId === activeCharacterId
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
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.ctrlKey) {
                  return;
                }
                if (event.isComposing) return;
                event.preventDefault();
                if (loading || !activeCharacter) return;
                (event.currentTarget.form as HTMLFormElement | null)
                  ?.requestSubmit();
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
