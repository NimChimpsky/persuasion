import { useEffect, useRef, useState } from "preact/hooks";
import { normalizeGender } from "../shared/validation.ts";
import type { UserGender, UserProfile } from "../shared/types.ts";

interface HeaderProfileButtonProps {
  userEmail: string;
  initialProfile: UserProfile | null;
  requiresProfileCompletion: boolean;
}

interface ProfileResponse {
  ok: boolean;
  error?: string;
}

export default function HeaderProfileButton(
  { userEmail, initialProfile, requiresProfileCompletion }:
    HeaderProfileButtonProps,
) {
  const [dialogOpen, setDialogOpen] = useState(requiresProfileCompletion);
  const [mustCompleteProfile, setMustCompleteProfile] = useState(
    requiresProfileCompletion,
  );
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [gender, setGender] = useState<UserGender>(
    initialProfile?.gender ?? "male",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setMustCompleteProfile(requiresProfileCompletion);
    if (requiresProfileCompletion) {
      setDialogOpen(true);
    }
  }, [requiresProfileCompletion]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (dialogOpen) {
      if (mustCompleteProfile) {
        dialog.setAttribute("open", "");
      }
      try {
        if (dialog.open) dialog.close();
        dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [dialogOpen, mustCompleteProfile]);

  const closeDialog = () => {
    if (mustCompleteProfile || pending) return;
    setDialogOpen(false);
    setError("");
  };

  const saveProfile = async (event: Event) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("gender", gender);
      formData.set(
        "next",
        globalThis.location.pathname + globalThis.location.search,
      );

      const response = await fetch("/profile", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });
      const payload = await response.json() as ProfileResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to save profile.");
      }

      setMustCompleteProfile(false);
      setDialogOpen(false);
      globalThis.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save profile.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        class="header-profile-trigger"
        onClick={() => setDialogOpen(true)}
      >
        {userEmail}
      </button>
      <dialog
        ref={dialogRef}
        class="profile-modal-dialog"
        open={mustCompleteProfile}
        onCancel={(event) => {
          if (mustCompleteProfile || pending) {
            event.preventDefault();
            return;
          }
          setDialogOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}
        onClose={() => {
          if (mustCompleteProfile || pending) {
            setDialogOpen(true);
            return;
          }
          setDialogOpen(false);
        }}
      >
        <section class="card profile-modal-card">
          {!mustCompleteProfile
            ? (
              <div class="profile-modal-close-row">
                <button
                  type="button"
                  class="btn ghost"
                  onClick={closeDialog}
                  disabled={pending}
                  aria-label="Close profile"
                >
                  Close
                </button>
              </div>
            )
            : null}
          <div class="profile-modal-copy">
            <h3>Profile</h3>
            <p class="muted">
              {mustCompleteProfile
                ? "Complete your profile before continuing."
                : "Update your profile details without leaving the page."}
            </p>
          </div>
          <p class="profile-modal-account">{userEmail}</p>
          <form
            method="POST"
            action="/profile"
            class="form-grid"
            onSubmit={saveProfile}
          >
            <input type="hidden" name="next" value="/home" />
            <label>
              Name
              <input
                type="text"
                name="name"
                value={name}
                required
                maxLength={60}
                placeholder="Your name"
                autoComplete="name"
                onInput={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label>
              Gender
              <select
                name="gender"
                value={gender}
                required
                onChange={(event) =>
                  setGender(normalizeGender(event.currentTarget.value))}
              >
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="non-binary">non-binary</option>
              </select>
            </label>
            {error ? <p class="notice bad">{error}</p> : null}
            <div class="profile-modal-actions">
              <button class="btn primary" type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
          <div class="profile-modal-links">
            <span class="muted">Session</span>
            <div class="action-row">
              <a class="btn ghost" href="/auth/logout-all">
                Log out all devices
              </a>
              <a class="btn ghost" href="/auth/logout">Log out</a>
            </div>
          </div>
        </section>
      </dialog>
    </>
  );
}
