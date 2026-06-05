import type { Handler } from "@netlify/functions";

const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      status: "ok",
      storage: "none",
      apiKeyConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
    }),
  };
};

export { handler };
