import { env } from "../../../lib/env.ts";
import { addUserCredits } from "../../../lib/store.ts";
import { verifyWebhookEvent } from "../../../lib/stripe.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const signature = ctx.req.headers.get("stripe-signature") ?? "";
    const body = await ctx.req.text();

    try {
      const event = await verifyWebhookEvent(
        body,
        signature,
        env.stripeWebhookSecret,
      );
      if (event.type === "checkout.session.completed") {
        await addUserCredits(event.userEmail, event.credits, true);
      }
    } catch (err) {
      console.error("Stripe webhook error:", err);
    }

    return new Response("ok", { status: 200 });
  },
});
