import { env } from "./env.ts";

export const CREDIT_PACKAGES = [
  { credits: 100, priceUsdCents: 100, label: "100 credits — $1.00" },
  { credits: 1000, priceUsdCents: 900, label: "1000 credits — $9.00" },
] as const;

export function isStripeConfigured(): boolean {
  return env.stripeSecretKey.length > 0;
}

export async function createCheckoutSession(
  credits: number,
  priceUsdCents: number,
  userEmail: string,
  baseUrl: string,
): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    return { url: `${baseUrl}/credits/success?credits=${credits}` };
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(priceUsdCents));
  params.set(
    "line_items[0][price_data][product_data][name]",
    `${credits} credits`,
  );
  params.set("line_items[0][quantity]", "1");
  params.set("customer_email", userEmail);
  params.set("metadata[userEmail]", userEmail);
  params.set("metadata[credits]", String(credits));
  params.set("success_url", `${baseUrl}/credits/success?credits=${credits}`);
  params.set("cancel_url", `${baseUrl}/home`);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe checkout failed: ${text}`);
  }

  const data = await res.json() as { url: string };
  return { url: data.url };
}

export async function verifyWebhookEvent(
  body: string,
  signature: string,
  secret: string,
): Promise<{ type: string; userEmail: string; credits: number }> {
  const sigParts = signature.split(",").reduce((acc, part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) acc[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
    return acc;
  }, {} as Record<string, string>);

  const timestamp = sigParts["t"];
  const v1 = sigParts["v1"];

  if (!timestamp || !v1) {
    throw new Error("Invalid Stripe-Signature header");
  }

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (hex !== v1) {
    throw new Error("Stripe webhook signature mismatch");
  }

  const event = JSON.parse(body) as {
    type: string;
    data: { object: { metadata: { userEmail: string; credits: string } } };
  };
  const metadata = event.data.object.metadata;
  return {
    type: event.type,
    userEmail: metadata.userEmail,
    credits: Number(metadata.credits),
  };
}
