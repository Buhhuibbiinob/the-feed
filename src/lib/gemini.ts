// Thin wrapper around Google's Gemini API (free tier via Google AI Studio).
// Server-only - GEMINI_API_KEY must never reach the client.
// Model history on this project, so nobody re-treads it:
//  - gemini-2.0-flash: shut down 2026-06-01. Returned quota-ish errors
//    rather than a clear "retired" message, which made it hard to diagnose.
//  - gemini-2.5-flash: 404s on this API key ("no longer available to new
//    users"), so it is not a usable fallback here despite still existing.
//  - gemini-3.6-flash: current, works on this key. 429s from it are free-tier
//    quota spikes, which the retry/backoff below handles.
// Override with GEMINI_MODEL to move models without a code change.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Free-tier quota spikes come back as 429; 500/503 are transient upstream
// blips. Both are worth retrying, and neither should crash the caller's UI.
const RETRY_STATUSES = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [5_000, 11_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini 2.5 takes thinkingConfig.thinkingBudget; Gemini 3 replaced it with
// thinkingLevel and rejects the request outright if it gets the legacy key
// (or both at once). Either way the goal is the same: keep the model from
// spending the whole maxOutputTokens budget thinking and leaving nothing
// for the visible answer.
function thinkingConfigFor(model: string): Record<string, unknown> {
  return model.startsWith("gemini-2.5")
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "minimal" };
}

type GroundingChunk = { uri: string; title: string };

type GeminiResult =
  | { ok: true; text: string; groundingChunks: GroundingChunk[] }
  | { ok: false; error: string };

async function callGemini(
  systemInstruction: string,
  userMessage: string,
  extraConfig: Record<string, unknown> = {},
  options: { useGoogleSearch?: boolean } = {}
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY is not set." };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    ...(options.useGoogleSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
      thinkingConfig: thinkingConfigFor(MODEL),
      ...extraConfig,
    },
  });

  // Retry rate limits and transient upstream errors with a growing pause
  // rather than surfacing a crash - a free-tier 429 is usually a short
  // burst, not a hard wall.
  let lastError = "";
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body }
      );

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        lastError = `Gemini API returned ${res.status}: ${errorBody.slice(0, 300)}`;
        if (RETRY_STATUSES.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
          console.warn(`[gemini] ${res.status} on attempt ${attempt + 1}, retrying in ${RETRY_DELAYS_MS[attempt]}ms`);
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        if (res.status === 429) {
          return {
            ok: false,
            error: `Gemini is rate limited right now (429) and didn't recover after ${RETRY_DELAYS_MS.length + 1} attempts. Wait a minute and try again, or raise the quota for ${MODEL} in Google AI Studio.`,
          };
        }
        return { ok: false, error: lastError };
      }

      const data = (await res.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
        }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (!text) return { ok: false, error: `Gemini returned no text. Raw: ${JSON.stringify(data).slice(0, 300)}` };

      const groundingChunks: GroundingChunk[] = (data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
        .filter((c) => c.web?.uri)
        .map((c) => ({ uri: c.web!.uri!, title: c.web!.title ?? c.web!.uri! }));

      return { ok: true, text, groundingChunks };
    } catch (err) {
      lastError = `Gemini request threw: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }

  return { ok: false, error: lastError || "Gemini request failed." };
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

export type AskGeminiJsonResult<T> =
  | { ok: true; data: T; sources: GroundingChunk[] }
  | { ok: false; error: string };

// Requests structured JSON output (Gemini's native JSON mode, not just
// asking nicely in the prompt) and parses it. Returns the real error
// message on failure (instead of just null) so callers with an admin UI
// can show the actual reason instead of guessing at one.
// Pass useGoogleSearch to ground the response in real, current web results
// (Gemini 3 supports combining Google Search grounding with JSON mode) -
// grounding sources are returned alongside the parsed JSON.
export async function askGeminiJson<T>(
  systemInstruction: string,
  userMessage: string,
  useGoogleSearch = false
): Promise<AskGeminiJsonResult<T>> {
  const result = await callGemini(
    systemInstruction,
    userMessage,
    { responseMimeType: "application/json" },
    { useGoogleSearch }
  );
  if (!result.ok) {
    console.error(`[gemini] ${result.error}`);
    return { ok: false, error: result.error };
  }
  try {
    return { ok: true, data: JSON.parse(result.text) as T, sources: result.groundingChunks };
  } catch (err) {
    const message = `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[gemini] ${message}`);
    return { ok: false, error: message };
  }
}
