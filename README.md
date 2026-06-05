# 🧠 DocuSolver AI

> **Upload any academic PDF → Get instant, pointwise answers with a downloadable PDF answer key.**

DocuSolver AI uses Google's Gemini AI to analyze uploaded academic documents, extract every question (including from scanned images, charts, and diagrams), and generate structured, pointwise solutions — all exportable as a professional PDF.

---

## ✨ Features

- 📄 **Smart PDF Analysis** — Extracts questions from text, images, charts, and diagrams
- 🎯 **Pointwise Answers** — Every answer structured with bullet points, step-by-step solutions
- 🌐 **Multi-Language Support** — English, Bengali, Banglish, Hindi, Hinglish, Tamil, Telugu, Marathi, Gujarati, Kannada
- 📊 **Math-Aware Formatting** — Given → Formula → Calculation → Result workflow for numerical problems
- 📥 **PDF Export** — Professional answer key with colored section cards, question badges, and page numbers
- 👁️ **PDF Preview** — Preview before downloading
- 🎨 **Dark Mode UI** — Premium glassmorphism design with smooth animations
- ⚡ **Adjustable Word Limit** — Control answer length (50–500 words)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Express 5, Node.js |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| PDF | jsPDF (direct rendering, no html2canvas) |
| Build | Vite 6, esbuild, tsx |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API Key

### Setup

```bash
# Clone the repo
git clone https://github.com/Subha12125/DocuSolver-ai.git
cd DocuSolver-ai

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### Run Locally

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
DocuSolver-ai/
├── App.tsx                 # Main application component
├── server.ts               # Express backend + Gemini API integration
├── index.html              # HTML entry point
├── index.tsx               # React entry point
├── index.css               # Global styles
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite build configuration
├── components/
│   └── QAView.tsx          # Answer display component (structured/plain/raw views)
├── services/
│   └── pdfService.ts       # PDF generation with jsPDF
├── netlify/
│   └── functions/
│       └── solve.ts        # Netlify serverless function for API
└── netlify.toml            # Netlify deployment configuration
```

---

## 🌐 Deploy to Netlify

This project is configured for one-click Netlify deployment:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Subha12125/DocuSolver-ai)

### Manual Deployment

1. Push to GitHub (already done)
2. Go to [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git**
3. Select the `DocuSolver-ai` repository
4. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
5. Add environment variable: `GEMINI_API_KEY` = your API key
6. Click **Deploy**

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `GEMINI_MODEL` | No | Model override (default: `gemini-2.5-flash`) |

---

## 📸 How It Works

1. **Upload** — Drag & drop or select any academic PDF
2. **Configure** — Choose language and word limit
3. **Solve** — AI analyzes and extracts all questions with answers
4. **Review** — View answers in Structured, Plain, or Raw mode
5. **Export** — Download or preview the professional PDF answer key

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Subha12125">Subha</a>
</p>
