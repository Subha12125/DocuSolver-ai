import { QAPair } from '../types';

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Determines if an HTTP status code is retryable.
 * 429 (rate limit), 500, 502, 503, 504 are all transient.
 */
function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

/**
 * Sleeps for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts a user-friendly error message from a failed response.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  const status = response.status;
  const contentType = response.headers.get("content-type") || "";

  // Try to get a JSON error body first
  if (contentType.includes("application/json")) {
    try {
      const errorData = await response.json();
      const serverMsg = errorData.error || errorData.message || "";

      // Enhance known error patterns
      if (serverMsg.includes("SAFETY") || serverMsg.includes("safety") || serverMsg.includes("blocked")) {
        return "The document was blocked by safety filters. Please ensure the PDF contains appropriate academic content and try again.";
      }
      if (serverMsg.includes("quota") || serverMsg.includes("RESOURCE_EXHAUSTED")) {
        return "API quota exceeded. Please wait a few minutes and try again, or check your Gemini API billing.";
      }
      if (serverMsg.includes("API key") || serverMsg.includes("API_KEY_INVALID") || status === 401 || status === 403) {
        return "Authentication failed. Please verify your Gemini API key is valid and has active billing/credits.";
      }
      if (serverMsg) return serverMsg;
    } catch {
      // JSON parse failed, fall through
    }
  }

  // Try to read text body for HTML error pages
  try {
    const text = await response.text();
    if (text.includes("<!doctype") || text.includes("<html") || text.includes("Cookie check") || text.includes("Action required")) {
      return "The preview environment requires cookie authorization. Please open the app in a dedicated browser tab.";
    }
  } catch {
    // Text read failed, fall through
  }

  // Status-specific fallback messages
  switch (status) {
    case 413:
      return "The PDF file is too large. Please try a smaller file (under 10MB).";
    case 429:
      return "Rate limit reached. Please wait a moment and try again.";
    case 502:
      return "The AI service is temporarily unavailable (502). Retrying...";
    case 503:
      return "The AI service is overloaded (503). Retrying...";
    case 504:
      return "The request timed out on the server. The PDF may be too complex — try a shorter document.";
    default:
      return `Server error (Status: ${status}). Please try again.`;
  }
}

/**
 * Extracts all questions from the PDF.
 */
export const extractQuestions = async (
  base64Data: string,
  apiKey: string
): Promise<string[]> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[DocuSolver] Retry ${attempt}/${MAX_RETRIES} for extractQuestions after ${delay}ms...`);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64Data, apiKey }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error("The request to extract questions timed out. Please try a smaller PDF.");
        break;
      }
      lastError = new Error(`Connection error: ${err.message || 'Could not reach the server.'}`);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      lastError = new Error(errorMsg);
      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        continue;
      }
      break;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      lastError = new Error(`Failed to parse extract response: ${err.message}`);
      break;
    }

    if (data && data.questions && Array.isArray(data.questions)) {
      return data.questions;
    }

    lastError = new Error("Invalid response format received from the extraction server.");
    break;
  }

  throw lastError || new Error("Failed to extract questions. Please try again.");
};

/**
 * Solves a single question using the PDF context.
 */
export const solveSingleQuestion = async (
  base64Data: string,
  apiKey: string,
  question: string,
  wordLimit: number,
  language: string
): Promise<QAPair> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[DocuSolver] Retry ${attempt}/${MAX_RETRIES} for solveSingleQuestion after ${delay}ms...`);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64Data,
          apiKey,
          wordLimit,
          language,
          questionToSolve: question,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error("Solving request timed out. Retrying may help.");
        break;
      }
      lastError = new Error(`Connection error: ${err.message || 'Could not reach the server.'}`);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      lastError = new Error(errorMsg);
      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        continue;
      }
      break;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      lastError = new Error(`Failed to parse solver response: ${err.message}`);
      break;
    }

    if (data && data.result) {
      return data.result;
    }

    lastError = new Error("Invalid response format received from the solver server.");
    break;
  }

  throw lastError || new Error("Failed to solve question. Please try again.");
};

/**
 * Legacy whole-document generation function.
 */
export const generateAnswers = async (
  base64Data: string,
  apiKey: string,
  wordLimit: number,
  language: string
): Promise<QAPair[]> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[DocuSolver] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64Data, apiKey, wordLimit, language }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        lastError = new Error(
          "The request timed out after 2 minutes. The document may be too large or complex. Please try a shorter PDF."
        );
        break;
      }
      lastError = new Error(
        `Network connection error: ${err.message || 'Could not reach the server.'}`
      );
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);
      lastError = new Error(errorMsg);
      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        continue;
      }
      break;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      try {
        const text = await response.text();
        if (text.includes("<!doctype") || text.includes("<html")) {
          lastError = new Error("The server returned an HTML page instead of data. Please ensure the backend is running.");
          break;
        }
      } catch { /* ignore */ }
      lastError = new Error("Server did not return a valid JSON response. Please ensure the backend is started.");
      break;
    }

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      lastError = new Error(`Failed to parse server response: ${err.message || 'Invalid JSON format'}`);
      break;
    }

    if (data && data.result && Array.isArray(data.result)) {
      if (data.result.length === 0) {
        lastError = new Error("No questions were detected in the document. Please ensure the PDF contains readable questions.");
        break;
      }
      return data.result;
    }

    if (data && data.error) {
      lastError = new Error(data.error);
      break;
    }

    lastError = new Error("Invalid response format received from the server.");
    break;
  }

  throw lastError || new Error("Failed to generate answers. Please try again.");
};
