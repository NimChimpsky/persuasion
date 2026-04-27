import { page } from "fresh";
import { define } from "../../utils.ts";

interface SuccessData {
  credits: number;
}

export const handler = define.handlers<SuccessData>({
  GET(ctx) {
    const url = new URL(ctx.req.url);
    const credits = parseInt(url.searchParams.get("credits") ?? "0", 10);
    return page({ credits });
  },
});

export default define.page<typeof handler>(function CreditsSuccessPage(
  { data },
) {
  return (
    <main class="page-shell">
      <div class="container stack credits-success-card">
        <h1 class="display">Payment Successful</h1>
        <p>{data.credits} credits have been added to your account.</p>
        <a class="btn primary" href="/home">Play</a>
      </div>
    </main>
  );
});
