import { env } from "../../../lib/env.ts";
import { json, readJsonBody } from "../../../lib/http.ts";
import { createCreditCheckout } from "../../../lib/payments.ts";
import { getCreditPackage } from "../../../shared/credit_packages.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    const email = ctx.state.userEmail;
    if (!email) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await readJsonBody<{ credits?: number }>(ctx.req);
    if (!body.ok) {
      return json({ error: "Invalid JSON payload" }, 400);
    }

    const pkg = getCreditPackage(Number(body.value.credits ?? 0));

    if (!pkg) {
      return json({ error: "Invalid package" }, 400);
    }

    const { url } = await createCreditCheckout({
      package: pkg,
      userEmail: email,
      baseUrl: env.appBaseUrl,
    });

    return json({ url });
  },
});
