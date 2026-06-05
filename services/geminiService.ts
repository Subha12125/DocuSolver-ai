import { QAPair } from '../types';

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 2000;
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Determines if the error/status is retryable.
 * Retry on: network errors, 429 (rate limit), 500, 502, 503, 504
 */
function isRetryable(status: number | null): boolean {
  if (status === null) return true; // network error — always retry
  return status === 429 || status >= 500;
}

/**
 * Sleeps for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempts to extract a meaningful error message from a response.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const errorData = await response.json();
      return errorData.error || `Server error (Status: ${response.status})`;
    } catch {
      return `Server error (Status: ${response.status})`;
    }
  }

  const text = await response.text().catch(() => "");

  // Detect HTML gateway/proxy pages
  if (text.includes("<!doctype") || text.includes("<html") || text.includes("Cookie check") || text.includes("Action required")) {
    return "The preview environment requires cookie authorization. Please click the 'Open in new tab' button at the top-right of your preview screen to run the app in a dedicated tab.";
  }

  // Detect common gateway errors
  if (response.status === 502) {
    return "The AI server is temporarily unavailable (502 Bad Gateway). This usually resolves within a few seconds — retrying automatically.";
  }
  if (response.status === 503) {
    return "The AI server is overloaded (503). Retrying automatically.";
  }
  if (response.status === 504) {
    return "The request took too long to process (504 Gateway Timeout). Try uploading a smaller PDF or try again.";
  }
  if (response.status === 429) {
    return "Rate limit exceeded. Please wait a moment and try again, or check your API key quota.";
  }
  if (response.status === 413) {
    return "The PDF file is too large for the server to process. Please use a file under 10MB.";
  }
  if (response.status === 401 || response.status === 403) {
    return "Authentication failed. Please check that your API Key is valid and has active billing/credits.";
  }

  return text || `Backend server error (Status: ${response.status}). Please try again.`;
}

export const generateAnswers = async (base64Data: string, apiKey: string, wordLimit: number, language: string): Promise<QAPair[]> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Exponential backoff before retry (not on first attempt)
    if (attempt > 0) {
      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`[DocuSolver] Retry attempt ${attempt}/${MAX_RETRIES} after ${backoffMs}ms...`);
      await sleep(backoffMs);
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pdfBase64: base64Data,
          apiKey,
          wordLimit,
          language
        }),
        signal: controller.signal
      });
    } catch (err: any) {
      clearTimeout(timeoutId);

      // AbortError means timeout
      if (err.name === 'AbortError') {
        lastError = new Error("The request timed out after 2 minutes. The PDF may be too large or the AI server is slow. Please try again with a smaller document.");
        continue; // retry
      }

      // Network error — retryable
      lastError = new Error(`Network connection error: ${err.message || 'Could not connect to backend server.'}`);
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }

    // Non-OK response
    if (!response.ok) {
      const errorMsg = await extractErrorMessage(response);

      // Only retry on retryable status codes
      if (isRetryable(response.status) && attempt < MAX_RETRIES) {
        lastError = new Error(errorMsg);
        continue;
      }

      throw new Error(errorMsg);
    }

    // Validate content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      if (text.includes("<!doctype") || text.includes("<html")) {
        throw new Error("The preview environment is waiting for cookie authorization. Please click the 'Open in new tab' button at the top-right of the preview panel.");
      }
      lastError = new Error("Server did not return a valid JSON response. Please ensure the backend is started.");
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    // Parse JSON
    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      lastError = new Error(`Failed to parse server response: ${err.message || 'Invalid JSON format'}`);
      if (attempt < MAX_RETRIES) continue;
      throw lastError;
    }

    // Validate shape
    if (data && data.result && Array.isArray(data.result)) {
      if (data.result.length === 0) {
        throw new Error("The AI could not find any questions in this document. Please ensure the PDF contains readable question text.");
      }
      return data.result;
    }

    // If we got JSON but wrong shape, try to extract from the data itself
    if (Array.isArray(data)) {
      return data;
    }

    lastError = new Error("Invalid response format received from the server. The AI model returned unexpected data.");
    if (attempt < MAX_RETRIES) continue;
    throw lastError;
  }

  // Exhausted all retries
  throw lastError || new Error("Failed to get a response after multiple attempts. Please try again.");
};
