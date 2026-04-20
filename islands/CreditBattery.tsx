import { useEffect, useState } from "preact/hooks";

const CREDIT_PACKAGES = [
  { credits: 100, priceUsdCents: 100, label: "100 credits — $1.00" },
  { credits: 1000, priceUsdCents: 900, label: "1000 credits — $9.00" },
] as const;

interface CreditBatteryProps {
  initialBalance: number;
  initialLastTopup: number;
}

function formatCredits(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

export default function CreditBattery(
  { initialBalance, initialLastTopup }: CreditBatteryProps,
) {
  void initialLastTopup;
  const [balance, setBalance] = useState(initialBalance);
  const [showModal, setShowModal] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json() as {
            balance: number;
            lastTopup: number;
          };
          setBalance(data.balance);
        }
      } catch {
        // Silently ignore — stale balance is fine
      }
    };

    globalThis.addEventListener("credits-updated", refresh);
    return () => globalThis.removeEventListener("credits-updated", refresh);
  }, []);
  const formattedBalance = formatCredits(balance);

  const handleBuy = async (credits: number) => {
    if (buying) return;
    setBuying(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      if (res.ok) {
        const data = await res.json() as { url: string };
        globalThis.location.href = data.url;
      }
    } catch {
      setBuying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        class={`credit-trigger ${balance < 0 ? "is-negative" : ""}`}
        title={`${formattedBalance} credits`}
        onClick={() => setShowModal(true)}
        aria-label="Credits balance — click to buy more"
      >
        <svg
          class="credit-trigger-icon"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.16" />
          <circle
            cx="12"
            cy="12"
            r="7.25"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
          <path
            d="M12 7.8v8.4M8.9 10.1h4.3a1.8 1.8 0 1 1 0 3.6h-2.4a1.8 1.8 0 1 0 0 3.6h4.3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="credit-trigger-value">{formattedBalance}</span>
      </button>

      {showModal
        ? (
          <div
            class="credit-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
          >
            <div class="credit-modal card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <strong>Buy Credits</strong>
                <button
                  type="button"
                  class="btn ghost"
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p class="muted" style="margin-bottom:16px; font-size:0.9rem;">
                Current balance: {formattedBalance} credits
              </p>
              <div class="stack">
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.credits}
                    type="button"
                    class="btn primary"
                    disabled={buying}
                    onClick={() => handleBuy(pkg.credits)}
                  >
                    {pkg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
        : null}
    </>
  );
}
