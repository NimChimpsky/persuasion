import type { RefObject } from "preact";
import type { Dispatch, StateUpdater } from "preact/hooks";
import type { TranscriptEvent } from "../../shared/types.ts";
import { renderMessageText } from "./message_text.tsx";
import type { CharacterRef } from "./types.ts";

interface ChatPanelProps {
  activeCharacter: CharacterRef | null;
  visibleEvents: TranscriptEvent[];
  loading: boolean;
  streamingCharacterId: string;
  streamingCharacterName: string;
  streamingText: string;
  activeCharacterId: string;
  messagesRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  draft: string;
  setDraft: Dispatch<StateUpdater<string>>;
  error: string;
  onSubmit: (event: Event) => void;
}

export default function ChatPanel(
  {
    activeCharacter,
    visibleEvents,
    loading,
    streamingCharacterId,
    streamingCharacterName,
    streamingText,
    activeCharacterId,
    messagesRef,
    textareaRef,
    draft,
    setDraft,
    error,
    onSubmit,
  }: ChatPanelProps,
) {
  return (
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
      {error ? <p class="notice bad chat-error">{error}</p> : null}
    </article>
  );
}
