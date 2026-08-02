// Thin wrapper around Google's Gemini API (free tier via Google AI Studio).
// Server-only - GEMINI_API_KEY must never reach the client.
// gemini-2.0-flash was shut down by Google on 2026-06-01 (silently returned
// errors instead of a clear "model retired" message, which is what made
// this so hard to diagnose) - gemini-3.6-flash is the current stable model.
const MODEL = "gemini-3.6-flash";

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
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
            // Gemini 3 models count "thinking" tokens against maxOutputTokens
            // itself (unlike the docs' general description), so without
            // capping thinking to "minimal" the model can burn the entire
            // budget reasoning and leave nothing for the actual answer,
            // producing responses that cut off after a few words.
            thinkingConfig: { thinkingLevel: "minimal" },
            ...extraConfig,
          },
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
  const result = await callGemini(systemInstruction, userMessage, { maxOutputTokens: 600 });
  if (!result.ok) {
    // Callers fall back silently to keep the UX smooth, so this is the only
    // place the real reason (quota, missing key, bad model name, etc.)
    // shows up anywhere - check Vercel's function logs for it.
    console.error(`[gemini] ${result.error}`);
    return null;
  }
  return result.text;
}

// Requests structured JSON output (Gemini's native JSON mode, not just
// asking nicely in the prompt) and parses it. Returns null on any failure
// so callers can fall back cleanly instead of crashing on bad JSON.
export async function askGeminiJson<T>(systemInstruction: string, userMessage: string): Promise<T | null> {
  const result = await callGemini(systemInstruction, userMessage, { responseMimeType: "application/json" });
  if (!result.ok) {
    console.error(`[gemini] ${result.error}`);
    return null;
  }
  try {
    return JSON.parse(result.text) as T;
  } catch (err) {
    console.error(`[gemini] JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
