import { env } from "../../../lib/env.ts";
import { addUserCredits } from "../../../lib/store.ts";
import {
  CREDIT_PACKAGES,
  createCheckoutSession,
  isStripeConfigured,
} from "../../../lib/stripe.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = await ctx.req.json() as { credits?: number };
    const pkg = CREDIT_PACKAGES.find((p) => p.credits === body.credits);

    if (!pkg) {
      return new Response(JSON.stringify({ error: "Invalid package" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (!isStripeConfigured()) {
      await addUserCredits(email, pkg.credits, true);
    }

    const baseUrl = env.appBaseUrl;
    const { url } = await createCheckoutSession(
      pkg.credits,
      pkg.priceUsdCents,
      email,
      baseUrl,
    );

    return new Response(JSON.stringify({ url }), {
      headers: { "content-type": "application/json" },
    });
  },
});
