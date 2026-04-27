export function formatCredits(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
