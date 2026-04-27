function renderInlineAsterisk(text: string) {
  const parts = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={`strong-${tokenIndex}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      parts.push(<em key={`em-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    }
    tokenIndex++;
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function renderMessageText(text: string) {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const renderedLine = renderInlineAsterisk(line);
    if (index === lines.length - 1) return [renderedLine];
    return [renderedLine, <br key={`br-${index}`} />];
  });
}

export function toSummaryText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const max = 96;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
