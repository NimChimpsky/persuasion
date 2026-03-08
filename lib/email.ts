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
      subject: "Your Persuasion sign-in link",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;border-radius:8px;overflow:hidden">
          <div style="padding:24px;text-align:center;background:linear-gradient(135deg,#0f172a,#0b1224)">
            <img src="https://persuasion.technology/logo/logo_text_white_gb.png" alt="Persuasion" style="height:40px" />
          </div>
          <div style="padding:32px 24px;background:#1e293b">
            <p style="color:#e5e7eb;margin:0 0 20px">Click the button below to sign in. This link expires in 1 hour.</p>
            <div style="text-align:center">
              <a href="${link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#ffffff;font-weight:bold;text-decoration:none;border-radius:6px;font-size:16px">
                Sign in to Persuasion
              </a>
            </div>
            <p style="margin-top:24px;font-size:12px;color:#9aa4b2">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `Use this link to sign in to Persuasion: ${link}`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error(`Resend error (${response.status}): ${details}`);
    throw new Error("email_send_failed");
  }
}
