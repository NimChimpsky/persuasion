import { useEffect, useState } from "preact/hooks";

const CREDIT_PACKAGES = [
  { credits: 100, priceUsdCents: 100, label: "100 credits — $1.00" },
  { credits: 1000, priceUsdCents: 900, label: "1000 credits — $9.00" },
] as const;

interface CreditBatteryProps {
  initialBalance: number;
  initialLastTopup: number;
}

export default function CreditBattery(
  { initialBalance, initialLastTopup }: CreditBatteryProps,
) {
  const [balance, setBalance] = useState(initialBalance);
  const [lastTopup, setLastTopup] = useState(initialLastTopup);
  const [showModal, setShowModal] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json() as { balance: number; lastTopup: number };
          setBalance(data.balance);
          setLastTopup(data.lastTopup);
        }
      } catch {
        // Silently ignore — stale balance is fine
      }
    };

    window.addEventListener("credits-updated", refresh);
    return () => window.removeEventListener("credits-updated", refresh);
  }, []);

  const fillPct = lastTopup > 0
    ? Math.min(100, Math.max(0, (balance / lastTopup) * 100))
    : 0;

  const fillColor = balance < 0
    ? "#c0392b"
    : fillPct >= 50
    ? "#22c55e"
    : fillPct >= 20
    ? "#f59e0b"
    : "#c0392b";

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
        class="battery-svg"
        title={`${balance.toFixed(2)} credits`}
        onClick={() => setShowModal(true)}
        aria-label="Credits balance — click to buy more"
      >
        <svg
          viewBox="0 0 36 18"
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="18"
          aria-hidden="true"
        >
          {/* Battery body */}
          <rect
            x="0.5"
            y="0.5"
            width="31"
            height="17"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
          {/* Battery terminal nub */}
          <rect x="32" y="6" width="3.5" height="6" rx="1" fill="currentColor" />
          {/* Fill */}
          <rect
            x="2"
            y="2"
            width={`${(fillPct / 100) * 28}`}
            height="14"
            rx="1.5"
            fill={fillColor}
          />
        </svg>
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
              <div
                style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"
              >
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
                Current balance: {balance.toFixed(2)} credits
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
