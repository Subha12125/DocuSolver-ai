# 🧠 DocuSolver AI

<p align="center">
  <img src="https://img.shields.io/github/license/Subha12125/DocuSolver-ai?style=for-the-badge&color=blue" alt="License" />
  <img src="https://img.shields.io/github/stars/Subha12125/DocuSolver-ai?style=for-the-badge&color=gold" alt="Stars" />
  <img src="https://img.shields.io/github/forks/Subha12125/DocuSolver-ai?style=for-the-badge&color=lightgray" alt="Forks" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge" alt="PRs Welcome" />
</p>

<p align="center">
  <b>Upload academic PDFs, extract questions automatically, and generate structured, pointwise answer keys.</b>
</p>

<p align="center">
  <i>Built with React 19, TypeScript, Express 5, Google Gemini 2.5 Flash, and jsPDF. Ready for 1-click Netlify Serverless Deployment.</i>
</p>

---

## 🌟 Key Features

*   📂 **Direct PDF Processing** — Upload any course materials, exam papers, or textbooks.
*   🔍 **Visual & Text Extraction** — Automatically extracts text and parses complex visual contexts (charts, diagrams, and equations) using multimodal AI.
*   📌 **Pointwise Answers** — Structured, readable solutions without unnecessary fluff or wordy explanations.
*   🔢 **Step-by-Step Math Solving** — Solves numerical problems using a clear layout: **Given** ➔ **Formula** ➔ **Calculation** ➔ **Result**.
*   🌐 **Polyglot Support** — Can parse and respond in English, Bengali, Banglish, Hindi, Hinglish, Tamil, Telugu, Marathi, Gujarati, Kannada, and more.
*   📄 **High-Fidelity PDF Export** — Downloads a professional answer key with clean typography, page numbers, status badges, and selectable vector text (no blurry screenshots).
*   🎭 **Dual View Engine** — Preview and read solutions directly inside the app in structured cards or copy raw markdown.
*   ⚙️ **Custom Word limits** — Dynamically adjust response lengths (50 to 500 words per question) to match your study preferences.
*   🔑 **Bring Your Own Key (BYOK)** — Completely client-driven API key handling. No server databases, no key storing, maximum privacy.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS, Framer Motion |
| **Backend** | Express 5, Node.js (for local dev) / Netlify Functions (for production) |
| **Generative AI** | Google Gemini 2.5 Flash (`@google/genai`) |
| **Document Generation** | jsPDF (native rendering library for lightweight vector documents) |

---

## 🚀 Quick Start (Local Development)

### 📋 Prerequisites
*   Node.js (v18.0.0 or higher)
*   npm (v9.0.0 or higher)
*   A Gemini API Key (Get a free one instantly from [Google AI Studio](https://aistudio.google.com/app/apikey))

### 🛠️ Step-by-Step Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Subha12125/DocuSolver-ai.git
    cd DocuSolver-ai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Prepare Environment Variables**
    ```bash
    cp .env.example .env
    ```
    *(Note: You do not need to configure any API keys in `.env` as the application prompts for your Gemini API key directly in the browser UI, ensuring safe client-side usage.)*

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    The app will start at [http://localhost:3000](http://localhost:3000).

---

## 📂 Project Structure

```text
DocuSolver-ai/
├── App.tsx                   # Main React component (layout, state, core upload logic)
├── server.ts                 # Express backend server (used for local development)
├── vite.config.ts            # Vite configuration (sets target port to 3000)
├── types.ts                  # TypeScript types for PDF parsing, solutions, and API responses
├── index.html                # Entry HTML document
├── index.tsx                 # React DOM mount point
├── index.css                 # Global Tailwind/Vanilla styles and custom scrollbars
├── components/
│   └── QAView.tsx            # Interactive solution viewer (tabs for structured cards, plain text, and raw code)
├── services/
│   └── pdfService.ts         # High-fidelity programmatic PDF builder using jsPDF
├── netlify/
│   └── functions/            # Serverless functions running on Netlify's edge
│       ├── solve.ts          # Serverless endpoint for PDF analysis and Gemini API calls
│       └── health.ts         # Serverless check endpoint to verify backend status
└── netlify.toml              # Netlify build redirection rules and function routing
```

---

## 🌐 Production Deployment (Netlify)

This repository is pre-configured to build and deploy as a Netlify serverless application out-of-the-box.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Subha12125/DocuSolver-ai)

### Manual Netlify Setup

1.  Commit and push your repository to your GitHub account.
2.  Login to [Netlify Console](https://app.netlify.com/).
3.  Click **Add new site** ➔ **Import from Git**.
4.  Authorize and choose the **DocuSolver-ai** repository.
5.  Netlify will automatically load parameters from [netlify.toml](file:///c:/Users/subha/Downloads/docusolver-ai-2.0/netlify.toml):
    *   **Build command:** `npm run build`
    *   **Publish directory:** `dist`
    *   **Functions directory:** `netlify/functions`
6.  Click **Deploy site**. No environment variables are required since users supply their own keys in the frontend.

---

## 🔑 Security & API Keys

DocuSolver AI is built around the **Bring Your Own Key (BYOK)** security design:
*   **Zero Logs:** Your API Key is never logged, stored, or transmitted to any third-party analytics database.
*   **Direct AI Communication:** The key is sent inside the payload headers directly to the API endpoint and is used solely for the duration of that request.
*   **Free Access:** Anyone can get a free, high-limit key via [Google AI Studio](https://aistudio.google.com/app/apikey).

---

## 📖 How to Use

1.  **Enter API Key**: Provide your Gemini API key in the top-right field of the application.
2.  **Upload File**: Drag and drop your academic PDF or click the browse button.
3.  **Choose Preferences**: Select your target language and set the desired word limits.
4.  **Solve**: Click **Generate Solutions**. The file will be parsed, and questions will appear sequentially.
5.  **Export/Download**: Use the **Download PDF** option to save a clean, professionally formatted offline copy.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with 🧠 and ❤️ by <a href="https://github.com/Subha12125">Subha</a>
</p>
