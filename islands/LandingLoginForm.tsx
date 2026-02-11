import { useState } from "preact/hooks";

interface LandingLoginFormProps {
  action: string;
}

interface RequestLinkResponse {
  ok?: boolean;
  message?: string;
  error?: string;
  previewLink?: string;
}

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LandingLoginForm(props: LandingLoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [previewLink, setPreviewLink] = useState("");

  const onSubmit = async (event: Event) => {
    event.preventDefault();

    if (status === "sending") return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!BASIC_EMAIL_REGEX.test(normalizedEmail)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      setPreviewLink("");
      return;
    }

    setStatus("sending");
    setMessage("");
    setPreviewLink("");

    try {
      const response = await fetch(props.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const rawBody = await response.text();
      let payload: RequestLinkResponse = {};
      try {
        payload = JSON.parse(rawBody) as RequestLinkResponse;
      } catch {
        payload = {};
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to send email right now.");
      }

      setStatus("success");
      setMessage(
        payload.message || "we sent a link to your inbox - it is valid for 1hr",
      );
      setPreviewLink(payload.previewLink ?? "");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to send email right now.",
      );
    }
  };

  return (
    <form
      method="POST"
      action={props.action}
      class="form-grid landing-login-form"
      onSubmit={onSubmit}
    >
      <input
        type="email"
        name="email"
        required
        autocomplete="email"
        placeholder="you@example.com"
        aria-label="Email address"
        value={email}
        onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
      />
      <div class="action-row center">
        <button
          class="btn ghost landing-cta-btn"
          type="submit"
          disabled={status === "sending"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          {status === "sending" ? "Sending..." : "Send sign-in link"}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </button>
      </div>

      <p
        class={`landing-inline-feedback ${
          status === "error" ? "is-error" : "is-success"
        } ${message ? "is-visible" : ""}`}
        aria-live="polite"
      >
        {message || "\u00A0"}
      </p>

      {previewLink
        ? (
          <p class="notice landing-notice landing-form-message">
            Dev preview link:
            <br />
            <a href={previewLink}>{previewLink}</a>
          </p>
        )
        : null}
    </form>
  );
}
