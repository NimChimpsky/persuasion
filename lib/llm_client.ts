interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export function buildChatEndpoint(baseUrl: string): string {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalized).toString();
}

export function extractMessageContent(data: ChatCompletionResponse): string {
  const choice = data.choices?.[0];
  if (!choice) return "";
  const messageContent = choice.message?.content;
  return typeof messageContent === "string"
    ? messageContent
    : Array.isArray(messageContent)
    ? messageContent.map((part) => part.text ?? "").join("")
    : "";
}

export function extractFirstJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1).trim();
  }

  return text.trim();
}

export interface CompletionResult {
  ok: boolean;
  text: string;
  status: number;
  details: string;
  inputTokens: number;
  outputTokens: number;
}

export async function requestModelCompletion(
  endpoint: string,
  apiKey: string,
  model: string,
  systemInstructions: string,
  userInput: string,
): Promise<CompletionResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      text: "",
      status: response.status,
      details,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const body = await response.json() as ChatCompletionResponse;
  return {
    ok: true,
    text: extractMessageContent(body).trim(),
    status: response.status,
    details: "",
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
  };
}
