import { env } from "./env.ts";

export async function sendMagicLinkEmail(
  email: string,
  link: string,
): Promise<{ delivered: boolean }> {
  if (!env.resendApiKey || !env.emailFrom) {
    console.log(`Magic link for ${email}: ${link}`);
    return { delivered: false };
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
        `<p>Use this link to sign in:</p><p><a href=\"${link}\">${link}</a></p><p>This link expires in 1 hour.</p>`,
      text: `Use this link to sign in: ${link}\n\nThis link expires in 1 hour.`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`Resend error (${response.status}): ${details}`);
    throw new Error("email_send_failed");
  }

  return { delivered: true };
}
