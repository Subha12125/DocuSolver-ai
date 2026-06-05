import type { Handler, HandlerEvent } from "@netlify/functions";

const SUPPORTED_LANGUAGES: Record<string, { label: string; instruction: string }> = {
  english: { label: "English", instruction: "Write the answer completely in clear academic English." },
  bengali: { label: "Bengali", instruction: "Write the answer completely in natural Bengali script (বাংলা), using accurate academic phrasing." },
  banglish: { label: "Banglish", instruction: "Write the answer in Bengali-English code-switching: Bengali sentence flow with important academic and technical terms kept in English." },
  hindi: { label: "Hindi", instruction: "Write the answer completely in standard Hindi script (हिन्दी / देवनागरी), using natural academic phrasing." },
  hinglish: { label: "Hinglish", instruction: "Write the answer in natural Hinglish using Latin script, with English academic and technical terms where helpful." },
  tamil: { label: "Tamil", instruction: "Write the answer completely in natural Tamil script (தமிழ்), using accurate academic phrasing." },
  telugu: { label: "Telugu", instruction: "Write the answer completely in natural Telugu script (తెలుగు), using accurate academic phrasing." },
  marathi: { label: "Marathi", instruction: "Write the answer completely in natural Marathi script (मराठी), using accurate academic phrasing." },
  gujarati: { label: "Gujarati", instruction: "Write the answer completely in natural Gujarati script (ગુજરાતી), using accurate academic phrasing." },
  kannada: { label: "Kannada", instruction: "Write the answer completely in natural Kannada script (ಕನ್ನಡ), using accurate academic phrasing." },
};

function getLanguageInstruction(language: unknown) {
  const normalized = typeof language === "string" ? language.toLowerCase().trim() : "english";
  return SUPPORTED_LANGUAGES[normalized] ?? SUPPORTED_LANGUAGES.english;
}

const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { pdfBase64, apiKey: requestApiKey, wordLimit = 150, language = "english" } = body;

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing pdfBase64 in request body" }) };
    }

    const boundedWordLimit = Math.min(Math.max(Number(wordLimit) || 150, 50), 500);
    const apiKey = typeof requestApiKey === "string" ? requestApiKey.trim() : "";
    if (!apiKey || apiKey === "__SERVER_KEY__") {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Please provide your Gemini API key. Get one free at https://aistudio.google.com/app/apikey" }) };
    }

    // Dynamic import to avoid bundling issues
    const { GoogleGenAI, Type } = await import("@google/genai");

    const ai = new GoogleGenAI({ apiKey });
    const selectedLanguage = getLanguageInstruction(language);

    const prompt = `
      You are an expert academic document analyzer.
      Analyze the provided PDF and identify every distinct question, including questions in scanned pages, images, charts, and diagrams.

      LANGUAGE RULES:
      - Extract the "question" field as faithfully as possible from the uploaded PDF.
      - Write the "answer" field in ${selectedLanguage.label}.
      - ${selectedLanguage.instruction}

      ANSWER STYLE:
      - Keep each answer within approximately ${boundedWordLimit} words.
      - ALWAYS write answers POINTWISE — every key point on its own line starting with "- ".
      - Never write long paragraphs. Break every idea into separate bullet points.
      - Start directly with the answer. No filler, no "Concept:" block.
      - Use plain text only. No Markdown tables, LaTeX blocks, or code fences.
      - Replace fragile math symbols with printable text: "pi", "theta", "degrees", "sqrt(x)", "integral".

      FORMATTING RULES FOR ALL ANSWERS:
      Use these section headers on their own line when applicable:
      - "Given:" to list known values (one per line)
      - "Find:" to state what needs to be determined
      - "Formula:" to state the formula
      - "Step 1:", "Step 2:", etc. for logical solution steps
      - "Calculation:" to show arithmetic
      - "Result:" or "Final Answer:" for the final result
      - "Conclusion:" for summary
      - "Note:" for remarks
      IMPORTANT: Do NOT use "Concept:" header. Start answers directly.

      NUMERICAL / MATH ANSWER RULES:
      - State known values under "Given:" with units, one value per line
      - State the relevant formula under "Formula:" before computing
      - Show each substitution step on its own line
      - Use "=>" for calculation flow
      - Always end with "Final Answer:" with result and units

      THEORY / DESCRIPTIVE ANSWER RULES:
      - Write EVERY point as a bullet starting with "- " on its own line
      - Each bullet should be one complete thought (1-2 sentences max)
      - For definitions: first bullet is the definition, following bullets are key characteristics
      - For comparisons: use separate bullets for each difference/similarity
      - Keep it scannable

      RESPONSE FORMAT:
      Return a JSON array. Each item must contain:
      - "question": extracted question text.
      - "answer": step-by-step solution in the selected answer language.
      - "diagram": optional SVG string.
      - "image": optional Base64 image data URI.
    `;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        { text: prompt },
      ],
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The extracted question text." },
              answer: { type: Type.STRING, description: "The structured step-by-step academic answer." },
              diagram: { type: Type.STRING, description: "Optional SVG string." },
              image: { type: Type.STRING, description: "Optional Base64 data URI." },
            },
            required: ["question", "answer"],
          },
        },
      },
    });

    // Check for empty or safety-blocked responses
    if (!response.text) {
      const candidates = (response as any).candidates;
      const feedback = (response as any).promptFeedback;
      if (feedback?.blockReason) {
        return { statusCode: 422, headers, body: JSON.stringify({ error: `The AI model blocked the request due to: ${feedback.blockReason}. Please try a different document.` }) };
      }
      if (candidates?.[0]?.finishReason && candidates[0].finishReason !== 'STOP') {
        return { statusCode: 422, headers, body: JSON.stringify({ error: `The AI model stopped processing due to: ${candidates[0].finishReason}.` }) };
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: "The AI model returned an empty response. This is usually temporary — please try again." }) };
    }

    // Safe JSON parsing with partial salvage
    let parsed: any;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      const rawText = response.text || "";
      const lastBracket = rawText.lastIndexOf("}");
      if (lastBracket > 0) {
        const salvaged = rawText.substring(0, lastBracket + 1) + "]";
        try {
          parsed = JSON.parse(salvaged);
          console.warn("Netlify: Salvaged truncated JSON response from Gemini.");
        } catch {
          return { statusCode: 502, headers, body: JSON.stringify({ error: "The AI model returned a malformed response. Try a smaller PDF or try again." }) };
        }
      } else {
        return { statusCode: 502, headers, body: JSON.stringify({ error: "The AI model returned an unparseable response. Please try again." }) };
      }
    }

    if (!Array.isArray(parsed)) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "The AI model returned an unexpected response format. Please try again." }) };
    }

    const cleaned = parsed
      .filter((item: any) => item && (item.question || item.answer))
      .map((item: any) => ({
        question: String(item.question || "").trim(),
        answer: String(item.answer || "").trim(),
        diagram: String(item.diagram || "").replace(/```xml/g, "").replace(/```svg/g, "").replace(/```/g, "").trim(),
        image: String(item.image || "").trim(),
      }));

    if (cleaned.length === 0) {
      return { statusCode: 422, headers, body: JSON.stringify({ error: "The AI could not find any questions in this document. Please ensure the PDF contains readable question text." }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ result: cleaned }) };
  } catch (e: any) {
    console.error("Netlify Function Error:", e);
    const message = e.message || "An error occurred.";

    if (message.includes("API key") || message.includes("403") || message.includes("401")) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid API key. Please check your Gemini API key." }) };
    }
    if (message.includes("429") || message.includes("Resource has been exhausted") || message.includes("quota")) {
      return { statusCode: 429, headers, body: JSON.stringify({ error: "API rate limit exceeded. Please wait a moment and try again." }) };
    }

    return { statusCode: 500, headers, body: JSON.stringify({ error: message }) };
  }
};

export { handler };
