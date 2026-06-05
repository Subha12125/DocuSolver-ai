import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);

const SUPPORTED_LANGUAGES: Record<string, { label: string; instruction: string }> = {
  english: {
    label: "English",
    instruction: "Write the answer completely in clear academic English.",
  },
  bengali: {
    label: "Bengali",
    instruction: "Write the answer completely in natural Bengali script (বাংলা), using accurate academic phrasing.",
  },
  banglish: {
    label: "Banglish",
    instruction: "Write the answer in Bengali-English code-switching: Bengali sentence flow with important academic and technical terms kept in English.",
  },
  hindi: {
    label: "Hindi",
    instruction: "Write the answer completely in standard Hindi script (हिन्दी / देवनागरी), using natural academic phrasing.",
  },
  hinglish: {
    label: "Hinglish",
    instruction: "Write the answer in natural Hinglish using Latin script, with English academic and technical terms where helpful.",
  },
  tamil: {
    label: "Tamil",
    instruction: "Write the answer completely in natural Tamil script (தமிழ்), using accurate academic phrasing.",
  },
  telugu: {
    label: "Telugu",
    instruction: "Write the answer completely in natural Telugu script (తెలుగు), using accurate academic phrasing.",
  },
  marathi: {
    label: "Marathi",
    instruction: "Write the answer completely in natural Marathi script (मराठी), using accurate academic phrasing.",
  },
  gujarati: {
    label: "Gujarati",
    instruction: "Write the answer completely in natural Gujarati script (ગુજરાતી), using accurate academic phrasing.",
  },
  kannada: {
    label: "Kannada",
    instruction: "Write the answer completely in natural Kannada script (ಕನ್ನಡ), using accurate academic phrasing.",
  },
};

function getLanguageInstruction(language: unknown) {
  const normalized = typeof language === "string" ? language.toLowerCase().trim() : "english";
  return SUPPORTED_LANGUAGES[normalized] ?? SUPPORTED_LANGUAGES.english;
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      storage: "none",
      apiKeyConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    });
  });

  app.post("/api/solve", async (req, res) => {
    try {
      const { pdfBase64, apiKey: requestApiKey, wordLimit = 150, language = "english" } = req.body;

      if (!pdfBase64 || typeof pdfBase64 !== "string") {
        return res.status(400).json({ error: "Missing pdfBase64 in request body" });
      }

      const boundedWordLimit = Math.min(Math.max(Number(wordLimit) || 150, 50), 500);
      let apiKey = typeof requestApiKey === "string" ? requestApiKey.trim() : "";
      if (!apiKey || apiKey === "__SERVER_KEY__") {
        apiKey = (process.env.GEMINI_API_KEY || "").trim();
      }
      if (!apiKey) {
        return res.status(400).json({
          error: "Gemini API key is not configured. Add GEMINI_API_KEY to your .env file.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "docusolver-ai",
          },
        },
      });

      const selectedLanguage = getLanguageInstruction(language);
      const prompt = `
        You are an expert academic document analyzer.
        Analyze the provided PDF and identify every distinct question, including questions in scanned pages, images, charts, and diagrams.

        LANGUAGE RULES:
        - Extract the "question" field as faithfully as possible from the uploaded PDF. If the original question is not English, keep it in the source language unless the text is unreadable.
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
        - "Given:" to list known values (one per line, e.g. "Mass (m) = 10 kg")
        - "Find:" to state what needs to be determined
        - "Formula:" to state the formula (e.g. "F = m × a")
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
        - Use "=>" for calculation flow (e.g. "= 10 × 9.8 => = 98 N")
        - Always end with "Final Answer:" with result and units
        - For multi-part problems, use "Step 1:", "Step 2:" etc.

        THEORY / DESCRIPTIVE ANSWER RULES:
        - Write EVERY point as a bullet starting with "- " on its own line
        - Each bullet should be one complete thought (1-2 sentences max)
        - Use "Explanation:" header only when extra context is needed
        - For definitions: first bullet is the definition, following bullets are key characteristics
        - For comparisons: use separate bullets for each difference/similarity
        - For processes: use numbered points or "Step 1:", "Step 2:" etc.
        - Keep it scannable — a reader should understand the answer by skimming bullets

        VISUAL HANDLING:
        - If a question relies on a visual element, include a [Visual Description] tag in the question text describing only the details needed to solve it.
        - If an answer needs a simple vector diagram, return a valid standalone SVG string in "diagram".
        - If a simple image is needed and can be safely represented as a Base64 data URI, return it in "image".

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
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: {
                  type: Type.STRING,
                  description: "The extracted question text.",
                },
                answer: {
                  type: Type.STRING,
                  description: "The structured step-by-step academic answer in the selected answer language.",
                },
                diagram: {
                  type: Type.STRING,
                  description: "Optional SVG string for diagrams.",
                },
                image: {
                  type: Type.STRING,
                  description: "Optional Base64 data URI for images.",
                },
              },
              required: ["question", "answer"],
            },
          },
        },
      });

      if (!response.text) {
        throw new Error("Empty response received from Gemini model.");
      }

      const parsed = JSON.parse(response.text);
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid response format received from Gemini model.");
      }

      const cleaned = parsed
        .filter((item: any) => item && (item.question || item.answer))
        .map((item: any) => ({
          question: String(item.question || "").trim(),
          answer: String(item.answer || "").trim(),
          diagram: String(item.diagram || "")
            .replace(/```xml/g, "")
            .replace(/```svg/g, "")
            .replace(/```/g, "")
            .trim(),
          image: String(item.image || "").trim(),
        }));

      res.json({ result: cleaned });
    } catch (e: any) {
      console.error("Server Solve Error:", e);
      res.status(500).json({ error: e.message || "An error occurred during content generation." });
    }
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Starting in development mode with Vite middleware.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Starting in production mode serving dist static files.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
