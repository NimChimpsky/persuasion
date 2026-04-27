import { addUserCredits } from "./store.ts";
import { createStripeCheckoutSession, isStripeConfigured } from "./stripe.ts";
import type { CreditPackage } from "../shared/credit_packages.ts";

interface CheckoutRequest {
  package: CreditPackage;
  userEmail: string;
  baseUrl: string;
}

interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<{ url: string }>;
}

const stripePaymentProvider: PaymentProvider = {
  async createCheckout({ package: pkg, userEmail, baseUrl }) {
    if (!isStripeConfigured()) {
      await addUserCredits(userEmail, pkg.credits, true);
      return { url: `${baseUrl}/credits/success?credits=${pkg.credits}` };
    }

    return await createStripeCheckoutSession(
      pkg.credits,
      pkg.priceUsdCents,
      userEmail,
      baseUrl,
    );
  },
};

export async function createCreditCheckout(
  request: CheckoutRequest,
): Promise<{ url: string }> {
  return await stripePaymentProvider.createCheckout(request);
}
