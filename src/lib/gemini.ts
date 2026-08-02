// Thin wrapper around Google's Gemini API (free tier via Google AI Studio).
// Server-only - GEMINI_API_KEY must never reach the client.
const MODEL = "gemini-2.0-flash";

type GeminiResult = { ok: true; text: string } | { ok: false; error: string };

async function callGemini(
  systemInstruction: string,
  userMessage: string,
  extraConfig: Record<string, unknown> = {}
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY is not set." };

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
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Gemini API returned ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!text) return { ok: false, error: `Gemini returned no text. Raw: ${JSON.stringify(data).slice(0, 300)}` };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `Gemini request threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function askGemini(systemInstruction: string, userMessage: string): Promise<string | null> {
  const result = await callGemini(systemInstruction, userMessage, { maxOutputTokens: 300 });
  return result.ok ? result.text : null;
}

// Requests structured JSON output (Gemini's native JSON mode, not just
// asking nicely in the prompt) and parses it. Returns null on any failure
// so callers can fall back cleanly instead of crashing on bad JSON.
export async function askGeminiJson<T>(systemInstruction: string, userMessage: string): Promise<T | null> {
  const result = await callGemini(systemInstruction, userMessage, { responseMimeType: "application/json" });
  if (!result.ok) return null;
  try {
    return JSON.parse(result.text) as T;
  } catch {
    return null;
  }
}
