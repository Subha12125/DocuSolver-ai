import { QAPair } from '../types';

export const generateAnswers = async (base64Data: string, apiKey: string, wordLimit: number, language: string): Promise<QAPair[]> => {
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
      })
    });
  } catch (err: any) {
    throw new Error(`Network connection error: ${err.message || 'Could not connect to backend server.'}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to analyze document (Status: ${response.status})`);
    } else {
      const text = await response.text().catch(() => "");
      if (text.includes("<!doctype") || text.includes("<html") || text.includes("Cookie check") || text.includes("Action required")) {
        throw new Error("The preview environment requires cookie authorization. Please click the 'Open in new tab' button at the top-right of your preview screen to run the app in a dedicated tab.");
      }
      throw new Error(`Backend server error (Status: ${response.status}). Please try again.`);
    }
  }

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");
    if (text.includes("<!doctype") || text.includes("<html") || text.includes("Cookie check") || text.includes("Action required")) {
      throw new Error("The preview environment is waiting for cookie authorization. Please click the 'Open in new tab' button at the top-right of the preview panel to load the fully functional app in a new tab.");
    }
    throw new Error("Server did not return a valid JSON response. Please ensure the backend is started.");
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err: any) {
    throw new Error(`Failed to read response JSON: ${err.message || 'Invalid format'}`);
  }

  if (data && data.result && Array.isArray(data.result)) {
    return data.result;
  }
  
  throw new Error("Invalid response format received from the server.");
};
