export interface CreditPackage {
  credits: number;
  priceUsdCents: number;
  label: string;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  { credits: 100, priceUsdCents: 100, label: "100 credits — $1.00" },
  { credits: 1000, priceUsdCents: 900, label: "1000 credits — $9.00" },
] as const;

export function getCreditPackage(credits: number): CreditPackage | null {
  return CREDIT_PACKAGES.find((pkg) => pkg.credits === credits) ?? null;
}
