export async function consumeSseStream(
  response: Response,
  onEvent: (eventName: string, data: string) => void,
): Promise<void> {
  if (!response.body) {
    throw new Error("No stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "message";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (!dataLines.length) {
      currentEvent = "message";
      return;
    }
    onEvent(currentEvent, dataLines.join("\n"));
    currentEvent = "message";
    dataLines = [];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, "");

      if (line === "") {
        dispatch();
      } else if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    dataLines.push(trailing.slice(5).trimStart());
  }
  dispatch();
}
