import { env } from "./env.ts";

export async function sendMagicLinkEmail(
  email: string,
  link: string,
): Promise<void> {
  if (!env.resendApiKey) {
    throw new Error("resend_not_configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [email],
      subject: "Your sign-in link",
      html:
        `<p>Use this link to sign in:</p><p><a href=\"${link}\">${link}</a></p>`,
      text: `Use this link to sign in: ${link}`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`Resend error (${response.status}): ${details}`);
    throw new Error("email_send_failed");
  }
}
