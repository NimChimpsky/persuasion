import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import CharacterList from "./game_board/CharacterList.tsx";
import ChatPanel from "./game_board/ChatPanel.tsx";
import { toSummaryText } from "./game_board/message_text.tsx";
import { consumeSseStream } from "./game_board/sse.ts";
import type {
  CharacterRef,
  JsonErrorResponse,
  StreamAckPayload,
  StreamDeltaPayload,
  StreamErrorPayload,
  StreamFinalPayload,
} from "./game_board/types.ts";
import { useDesktopBoardHeight } from "./game_board/useDesktopBoardHeight.ts";
import type { TranscriptEvent } from "../shared/types.ts";

interface GameBoardProps {
  slug: string;
  introText: string;
  characters: CharacterRef[];
  initialEvents: TranscriptEvent[];
  initialEncounteredCharacterIds: string[];
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
  return firstEncountered?.id ?? characters[0]?.id ?? "";
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
  const [introCollapsed, setIntroCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const layoutRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { desktopBoardHeight, isDesktopLayout } = useDesktopBoardHeight(
    layoutRef,
    characters.length,
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
          setCharacters(payload.characters as CharacterRef[]);
          setEncounteredCharacterIds(payload.encounteredCharacterIds);
          setStreamingText("");
          setStreamingCharacterName("");
          setStreamingCharacterId("");
          sawFinal = true;
          globalThis.dispatchEvent(new CustomEvent("credits-updated"));
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
    <>
      {introCollapsed
        ? (
          <button
            type="button"
            class="intro-pill"
            onClick={() => setIntroCollapsed(false)}
          >
            📖 Story
          </button>
        )
        : (
          <div class="intro-band">
            <div class="intro-band__inner">
              <p>{props.introText}</p>
              <button
                type="button"
                class="intro-band__toggle btn ghost"
                onClick={() => setIntroCollapsed(true)}
              >
                ▲ Hide
              </button>
            </div>
          </div>
        )}
      <section class="game-layout" ref={layoutRef} style={layoutStyle}>
        <CharacterList
          characters={characters}
          activeCharacterId={activeCharacterId}
          encounteredSet={encounteredSet}
          summaryByCharacterId={summaryByCharacterId}
          loading={loading}
          hasPlaceholderSlot={hasPlaceholderSlot}
          onSelect={setActiveCharacterId}
        />
        <ChatPanel
          activeCharacter={activeCharacter}
          visibleEvents={visibleEvents}
          loading={loading}
          streamingCharacterId={streamingCharacterId}
          streamingCharacterName={streamingCharacterName}
          streamingText={streamingText}
          activeCharacterId={activeCharacterId}
          messagesRef={messagesRef}
          textareaRef={textareaRef}
          draft={draft}
          setDraft={setDraft}
          error={error}
          onSubmit={onSubmit}
        />
      </section>
    </>
  );
}
