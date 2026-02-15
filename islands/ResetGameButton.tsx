import { useEffect, useRef, useState } from "preact/hooks";

interface ResetGameButtonProps {
  slug: string;
}

interface ResetResponse {
  ok?: boolean;
  error?: string;
}

export default function ResetGameButton(props: ResetGameButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (confirmOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [confirmOpen]);

  const executeReset = async () => {
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/games/${props.slug}/reset`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json() as ResetResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to reset game progress.");
      }

      globalThis.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reset game progress.",
      );
    } finally {
      setPending(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div class="game-intro-actions">
      <button
        type="button"
        class="btn ghost"
        onClick={() => setConfirmOpen(true)}
        disabled={pending}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 2v6h6" />
          <path d="M21 12a9 9 0 0 0-15.6-6.3L3 8" />
          <path d="M21 22v-6h-6" />
          <path d="M3 12a9 9 0 0 0 15.6 6.3L21 16" />
        </svg>
        {pending ? "Resetting..." : "Reset game"}
      </button>
      {error ? <p class="inline-meta notice bad">{error}</p> : null}
      <dialog
        ref={dialogRef}
        class="reset-modal-dialog"
        onCancel={(event) => {
          if (pending) {
            event.preventDefault();
            return;
          }
          setConfirmOpen(false);
        }}
        onClose={() => {
          if (!pending) {
            setConfirmOpen(false);
          }
        }}
      >
        <section class="card reset-modal-card">
          <h3>Reset game progress</h3>
          <p class="reset-modal-message">
            Are you sure you want to start again
          </p>
          <div class="reset-modal-actions">
            <button
              type="button"
              class="btn ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn primary"
              onClick={executeReset}
              disabled={pending}
            >
              {pending ? "Resetting..." : "Start again"}
            </button>
          </div>
        </section>
      </dialog>
    </div>
  );
}
