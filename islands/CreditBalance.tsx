import { useEffect, useState } from "preact/hooks";

interface CreditBalanceProps {
  initial: number;
}

export default function CreditBalance({ initial }: CreditBalanceProps) {
  const [balance, setBalance] = useState(initial);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/credits");
        if (res.ok) {
          const data = await res.json() as { balance: number };
          setBalance(data.balance);
        }
      } catch {
        // Silently ignore — stale balance is fine
      }
    };

    window.addEventListener("credits-updated", refresh);
    return () => window.removeEventListener("credits-updated", refresh);
  }, []);

  const isNegative = balance < 0;
  return (
    <span
      class={`header-credits${isNegative ? " header-credits--negative" : ""}`}
      title="Credits remaining"
    >
      {balance.toFixed(2)} credits
    </span>
  );
}
