// Thin wrapper around Google's Gemini API (free tier via Google AI Studio).
// Server-only - GEMINI_API_KEY must never reach the client.
const MODEL = "gemini-2.0-flash";

async function callGemini(
  systemInstruction: string,
  userMessage: string,
  extraConfig: Record<string, unknown> = {}
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7, ...extraConfig },
        }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text || null;
  } catch {
    return null;
  }
}

export async function askGemini(systemInstruction: string, userMessage: string): Promise<string | null> {
  return callGemini(systemInstruction, userMessage, { maxOutputTokens: 300 });
}

// Requests structured JSON output (Gemini's native JSON mode, not just
// asking nicely in the prompt) and parses it. Returns null on any failure
// so callers can fall back cleanly instead of crashing on bad JSON.
export async function askGeminiJson<T>(systemInstruction: string, userMessage: string): Promise<T | null> {
  const text = await callGemini(systemInstruction, userMessage, { responseMimeType: "application/json" });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
