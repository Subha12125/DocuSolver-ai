import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ProcessingIndicator from './components/ProcessingIndicator';
import QAView from './components/QAView';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { fileToBase64, generateAnswerPDF, openPDFPreview } from './services/pdfService';
import { generateAnswers } from './services/geminiService';
import { QAPair, ProcessingState, ProcessingStatus } from './types';
import { motion } from 'motion/react';

const LANGUAGE_NATIVE_LABELS: Record<string, string> = {
  english: 'English',
  bengali: 'বাংলা',
  banglish: 'বাংলা + Eng',
  hindi: 'हिन्दी',
  hinglish: 'Hinglish',
  tamil: 'தமிழ்',
  telugu: 'తెలుగు',
  marathi: 'मराठी',
  gujarati: 'ગુજરાતી',
  kannada: 'ಕನ್ನಡ',
};

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: ProcessingStatus.IDLE
  });
  const [qaPairs, setQaPairs] = useState<QAPair[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [wordLimit, setWordLimit] = useState<number>(150);
  const [language, setLanguage] = useState<string>('english');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  const checkConfig = async () => {
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const data = await response.json();
        if (data.apiKeyConfigured) {
          setApiKey("__SERVER_KEY__");
        }
        setProcessingState({ status: ProcessingStatus.IDLE });
      } else {
        setProcessingState({
          status: ProcessingStatus.ERROR,
          message: "Failed to connect to the backend server."
        });
      }
    } catch (err) {
      setProcessingState({
        status: ProcessingStatus.ERROR,
        message: "Failed to connect to the backend server."
      });
    } finally {
      setIsCheckingConfig(false);
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleApiKeySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedKey) {
      addToast("Gemini API key is required before processing", "error");
      return;
    }
    setApiKey(trimmedKey);
    setApiKeyInput('');
    addToast("Gemini API key added for this session", "success");
  };

  const handleFileSelect = async (file: File) => {
    try {
      if (!apiKey) {
        const msg = "Please add your Gemini API key before uploading a PDF.";
        setProcessingState({
          status: ProcessingStatus.ERROR,
          message: msg
        });
        addToast(msg, 'error');
        return;
      }

      // Step 1: Read PDF
      setProcessingState({
        status: ProcessingStatus.READING_PDF,
        message: 'Reading document structure...'
      });

      // Convert file to base64 for Gemini
      const base64Data = await fileToBase64(file);

      // Step 2: Analyze & Generate
      setProcessingState({
        status: ProcessingStatus.ANALYZING,
        message: 'Analyzing content...'
      });

      // Gemini Analysis
      const generatedPairs = await generateAnswers(base64Data, apiKey, wordLimit, language);
      setQaPairs(generatedPairs);

      setProcessingState({ status: ProcessingStatus.COMPLETE });
      addToast("Analysis complete!", 'success');

    } catch (error: any) {
      console.error(error);
      const rawErrorMsg = error.message || "An unexpected error occurred.";
      let userFriendlyMsg = rawErrorMsg;

      // Enhance error feedback for common issues
      if (rawErrorMsg.includes("Invalid response format") || rawErrorMsg.includes("Failed to generate answers")) {
        userFriendlyMsg = "We couldn't extract content from this document. This often happens with scanned images (non-OCR), handwritten text, or highly complex layouts. Please ensure the PDF contains selectable text.";
      } else if (rawErrorMsg.includes("API Key") || rawErrorMsg.includes("403") || rawErrorMsg.includes("401")) {
        userFriendlyMsg = "Authentication failed. Please check that your API Key is valid and has active billing/credits.";
      }

      setProcessingState({
        status: ProcessingStatus.ERROR,
        message: userFriendlyMsg
      });

      // Show a shorter version in toast, detail in the UI
      addToast(userFriendlyMsg.length > 50 ? "Analysis failed. See details." : userFriendlyMsg, 'error');
    }
  };

  const handleDownload = async () => {
    if (qaPairs.length > 0 && !isGeneratingPdf) {
      try {
        setIsGeneratingPdf(true);
        addToast("Generating PDF with diagrams...", "info");
        const warnings = await generateAnswerPDF(qaPairs);

        if (warnings && warnings.length > 0) {
          addToast(`PDF generated with warnings: ${warnings.length} images failed.`, 'info');
        } else {
          addToast("Answer key PDF downloaded successfully", 'success');
        }
      } catch (e) {
        addToast("Failed to generate PDF", 'error');
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  const handlePreview = async () => {
    if (qaPairs.length > 0 && !isGeneratingPdf) {
      try {
        setIsGeneratingPdf(true);
        addToast("Preparing PDF preview...", 'info');
        const warnings = await openPDFPreview(qaPairs);

        if (warnings && warnings.length > 0) {
          addToast(`${warnings.length} images failed to render in preview.`, 'info');
        }
      } catch (e) {
        addToast("Failed to open preview", 'error');
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  const handleReset = () => {
    setQaPairs([]);
    setIsCheckingConfig(true);
    checkConfig();
  };

  if (isCheckingConfig) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#6D5DFC]"></div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden min-h-screen bg-[#0F1117] flex flex-col font-sans selection:bg-[#6D5DFC]/30 selection:text-[#8B7FFF] relative overflow-hidden">
      {/* Specular Background Grid Mask */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none -z-10" />

      <Header 
        apiKey={apiKey} 
        apiKeyInput={apiKeyInput} 
        setApiKeyInput={setApiKeyInput} 
        onClearKey={() => {
          setApiKey('');
          setApiKeyInput('');
          addToast("Gemini API key cleared", "info");
        }}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16 relative">
        
        {processingState.status === ProcessingStatus.IDLE && (
          <div className="space-y-24 pt-2 pb-8">
            
            {/* SECTION 1 — HERO */}
            <div className="grid lg:grid-cols-12 gap-12 items-center pt-4 pb-12 lg:pt-6 lg:pb-20">
              <div className="lg:col-span-6 space-y-6 text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#6D5DFC]/10 border border-[#6D5DFC]/20 rounded-full text-[10px] font-bold text-[#8B7FFF] uppercase tracking-wider font-sans mb-2">
                  <span>✨ AI-Powered Document Solver</span>
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6.5xl font-black text-white tracking-tight leading-[1.08] font-display">
                  Turn Any Question PDF <br />
                  Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6D5DFC] via-[#8B7FFF] to-[#8B7FFF]/70">Perfect Answers</span>
                </h1>
                
                <p className="text-base sm:text-lg text-[#B8C0CC] font-normal leading-relaxed max-w-xl">
                  Upload quizzes, assignments, worksheets, or scanned documents and receive accurate, structured, AI-generated answers in seconds.
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <button 
                    onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-[#6D5DFC] hover:bg-[#6D5DFC]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#6D5DFC]/10 flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <i className="ri-upload-2-line text-base"></i>
                    Upload PDF
                  </button>
                  <button 
                    onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="bg-zinc-800/40 hover:bg-zinc-800 text-white border border-zinc-700/50 font-semibold px-6 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <i className="ri-play-circle-line text-base"></i>
                    See Demo
                  </button>
                </div>

                <div className="pt-6 flex items-center gap-3.5">
                  {/* Overlapping Mock CSS Student Avatars */}
                  <div className="flex -space-x-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full border-2 border-[#0F1117] bg-teal-500 text-white flex items-center justify-center font-bold text-[10px] tracking-tight">JD</div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#0F1117] bg-indigo-500 text-white flex items-center justify-center font-bold text-[10px] tracking-tight">AS</div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#0F1117] bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] tracking-tight">KC</div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#0F1117] bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] tracking-tight">RL</div>
                  </div>
                  
                  <div className="flex flex-col text-left">
                    <div className="flex gap-0.5 text-amber-400">
                      <i className="ri-star-fill text-xs"></i>
                      <i className="ri-star-fill text-xs"></i>
                      <i className="ri-star-fill text-xs"></i>
                      <i className="ri-star-fill text-xs"></i>
                      <i className="ri-star-fill text-xs"></i>
                    </div>
                    <p className="text-[11px] font-bold text-[#8B93A7] mt-0.5">
                      Trusted by 5,000+ students and educators
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side: Mock Document Solving Demonstration */}
              <div className="lg:col-span-6 flex justify-center relative select-none">
                {/* Background ambient light effects */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#6D5DFC]/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
                <div className="absolute right-[-10%] top-[10%] w-24 h-24 bg-grid-pattern opacity-30 pointer-events-none"></div>

                <div className="flex items-center gap-4 relative lg:scale-[0.85] xl:scale-100 origin-center transition-transform">
                  
                  {/* Left Mock Card: "Math Quiz.pdf" */}
                  <div className="w-[190px] h-[330px] bg-[#161A23] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between text-left relative overflow-hidden">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <i className="ri-file-text-fill text-rose-500 text-sm"></i>
                          <span className="text-[10px] font-bold text-white truncate">Math Quiz.pdf</span>
                        </div>
                        <span className="px-1 py-0.5 bg-rose-500/10 text-rose-500 text-[8px] font-black rounded tracking-wide">PDF</span>
                      </div>

                      {/* Question 1 */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-white leading-relaxed">
                          1. Solve for x:<br />
                          2x + 5 = 17
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-[8px] text-[#8B93A7] font-semibold pl-1 font-mono">
                          <div>A) 3</div>
                          <div>B) 6</div>
                          <div>C) 5</div>
                          <div>D) 7</div>
                        </div>
                      </div>

                      {/* Question 2 */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-white leading-relaxed">
                          2. What is the derivative of f(x) = x² + 3x?
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-[8px] text-[#8B93A7] font-semibold pl-1 font-mono">
                          <div>A) 2x + 3</div>
                          <div>B) x + 3</div>
                          <div>C) 2x</div>
                          <div>D) x² + 3</div>
                        </div>
                      </div>
                    </div>
                    {/* Simulated page line placeholders */}
                    <div className="space-y-1 pb-1">
                      <div className="h-1 bg-zinc-800 rounded w-full"></div>
                      <div className="h-1 bg-zinc-800 rounded w-5/6"></div>
                    </div>
                  </div>

                  {/* Center glowing badge connector */}
                  <div className="flex flex-col items-center justify-center gap-2 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-[#6D5DFC] text-white flex items-center justify-center shadow-lg shadow-[#6D5DFC]/20 border border-[#8B7FFF]/30 animate-pulse relative">
                      <i className="ri-sparkling-fill text-base"></i>
                    </div>
                    <i className="ri-arrow-right-line text-[#8B93A7] text-lg leading-none"></i>
                  </div>

                  {/* Right Mock Card: Solved Answers */}
                  <div className="w-[220px] h-[360px] bg-[#161A23] border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between text-left relative overflow-hidden">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="bg-[#6D5DFC] p-1 rounded text-white flex items-center justify-center">
                            <i className="ri-cpu-line text-[9px] leading-none"></i>
                          </div>
                          <span className="text-[10px] font-bold text-white">DocuSolver AI</span>
                        </div>
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold rounded flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                          Completed
                        </span>
                      </div>

                      {/* Question 1 Solution */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-white">1. Solve for x: 2x + 5 = 17</p>
                        <p className="text-[8px] font-semibold text-[#8B93A7] font-mono">Answer: <span className="text-white font-bold">B) 6</span></p>
                        
                        <div className="bg-[#0F1117]/80 border border-zinc-850 p-2 rounded-lg space-y-1 font-mono text-[8px] text-[#B8C0CC]">
                          <p className="text-[7px] text-[#8B93A7] font-sans font-bold uppercase tracking-wider mb-0.5">Explanation</p>
                          <div>2x + 5 = 17</div>
                          <div>2x = 17 - 5</div>
                          <div>2x = 12</div>
                          <div className="inline-block text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-1 py-0.5 rounded font-bold mt-0.5">x = 6</div>
                        </div>
                      </div>

                      {/* Question 2 Solution */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-white">2. What is the derivative of f(x) = x² + 3x?</p>
                        <p className="text-[8px] font-semibold text-[#8B93A7] font-mono">Answer: <span className="text-white font-bold">A) 2x + 3</span></p>
                        
                        <div className="bg-[#0F1117]/80 border border-zinc-850 p-2 rounded-lg space-y-1 font-mono text-[8px] text-[#B8C0CC]">
                          <p className="text-[7px] text-[#8B93A7] font-sans font-bold uppercase tracking-wider mb-0.5">Explanation</p>
                          <div>d/dx (x²) = 2x</div>
                          <div>d/dx (3x) = 3</div>
                          <div className="inline-block text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-1 py-0.5 rounded font-bold mt-0.5">So, f'(x) = 2x + 3</div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* SECTION 2 — UPLOAD EXPERIENCE */}
            <div id="upload-section" className="scroll-mt-24 w-full max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                  Start Extracting Solutions
                </h2>
                <p className="text-xs text-[#8B93A7] max-w-md mx-auto leading-relaxed">
                  Enter your API key and upload your worksheet below to activate the solver environment.
                </p>
              </div>

              {!apiKey ? (
                /* Premium Center API Key setup card */
                <div className="bg-[#161A23] border border-zinc-800 rounded-2xl p-8 shadow-lg max-w-lg mx-auto space-y-6">
                  <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-5">
                    <div className="bg-[#6D5DFC]/10 p-3 rounded-xl text-[#8B7FFF]">
                      <i className="ri-key-2-line text-2xl leading-none"></i>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-white text-sm tracking-tight">Gemini API Key Required</h4>
                      <p className="text-xs text-[#8B93A7] mt-0.5">Your key remains secure in your browser memory.</p>
                    </div>
                  </div>

                  <p className="text-xs text-[#B8C0CC] leading-relaxed text-left">
                    To solve document contents, DocuSolver connects directly to the official Google Gemini API. You can obtain a free key with daily processing credits from the Google AI Studio dashboard.
                  </p>

                  <form onSubmit={handleApiKeySubmit} className="space-y-4 text-left">
                    <div className="relative">
                      <i className="ri-key-2-line absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="Paste your Gemini API Key..."
                        autoComplete="off"
                        className="w-full bg-[#1D2230] text-white placeholder-zinc-500 text-xs pl-11 pr-4 py-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#6D5DFC] focus:ring-1 focus:ring-[#6D5DFC]/20 transition-all font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <a 
                        href="https://aistudio.google.com/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#8B7FFF] hover:text-[#6D5DFC] transition-colors flex items-center gap-1"
                      >
                        Get free API Key <i className="ri-external-link-line text-[10px]"></i>
                      </a>
                      <button 
                        type="submit" 
                        className="bg-[#6D5DFC] hover:bg-[#6D5DFC]/90 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        Activate Workspace
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Uploader Card and Settings */
                <div className="space-y-6">
                  <FileUpload 
                    onFileSelect={handleFileSelect} 
                    disabled={!apiKey} 
                  />

                  {/* Output Options */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-[#161A23] p-5 rounded-xl border border-zinc-800 flex items-center justify-between gap-4 shadow-sm text-left">
                      <div className="flex items-center gap-3">
                        <div className="bg-[#6D5DFC]/10 p-2.5 rounded-xl text-[#8B7FFF] flex items-center justify-center">
                          <i className="ri-translate-2 text-base leading-none"></i>
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs tracking-tight">Target Language</h4>
                          <p className="text-[10px] text-[#8B93A7] mt-0.5">Solve output language</p>
                        </div>
                      </div>
                      
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-[#1D2230] text-white text-xs px-3.5 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-[#6D5DFC] transition-all cursor-pointer font-semibold font-sans"
                      >
                        {Object.entries(LANGUAGE_NATIVE_LABELS).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-[#161A23] p-5 rounded-xl border border-zinc-800 flex flex-col justify-center space-y-3 shadow-sm text-left">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#6D5DFC]/10 p-2.5 rounded-xl text-[#8B7FFF] flex items-center justify-center">
                            <i className="ri-equalizer-line text-base leading-none"></i>
                          </div>
                          <span className="font-bold text-white text-xs tracking-tight">Explanation Detail</span>
                        </div>
                        <span className="bg-[#6D5DFC]/10 text-[#8B7FFF] text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                          ~{wordLimit} words
                        </span>
                      </div>
                      <input
                        id="word-limit"
                        type="range"
                        min="50"
                        max="500"
                        step="10"
                        value={wordLimit}
                        onChange={(e) => setWordLimit(Number(e.target.value))}
                        className="w-full h-1 bg-[#1D2230] rounded-lg appearance-none cursor-pointer accent-[#6D5DFC] transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3 — FEATURES */}
            <div className="space-y-12 w-full max-w-4xl mx-auto">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-bold text-[#8B7FFF] uppercase tracking-widest">
                  Academic Capabilities
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                  Robust Engine Built for Solving
                </h2>
                <p className="text-xs text-[#8B93A7] max-w-sm mx-auto leading-relaxed">
                  Everything you need to extract and format academic coursework instantly.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                {[
                  {
                    title: "Multimodal Understanding",
                    desc: "Understands text, handwritten notes, diagrams, tables, and images.",
                    icon: "ri-shield-check-line"
                  },
                  {
                    title: "High-Fidelity Answers",
                    desc: "Accurate, step-by-step solutions with detailed explanations.",
                    icon: "ri-file-chart-line"
                  },
                  {
                    title: "Structured Output",
                    desc: "Well-organized answers you can read, copy, and share easily.",
                    icon: "ri-list-check"
                  },
                  {
                    title: "OCR Recognition",
                    desc: "Extracts text from scanned documents and blurry images.",
                    icon: "ri-focus-2-line"
                  },
                  {
                    title: "Translation Support",
                    desc: "Get answers in your preferred language instantly.",
                    icon: "ri-translate-2"
                  },
                  {
                    title: "Custom Explanation",
                    desc: "Control explanation depth from short to comprehensive.",
                    icon: "ri-chat-voice-line"
                  }
                ].map((feature, i) => (
                  <div 
                    key={i} 
                    className="p-6 rounded-xl border border-zinc-800 bg-[#161A23] hover:border-zinc-700 transition-all duration-300 group hover:-translate-y-0.5 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#1D2230] text-[#8B7FFF] flex items-center justify-center mb-4 group-hover:bg-[#6D5DFC]/10 group-hover:text-[#6D5DFC] transition-colors">
                      <i className={`${feature.icon} text-lg`}></i>
                    </div>
                    <h4 className="font-bold text-white text-sm tracking-tight mb-2">{feature.title}</h4>
                    <p className="text-[#8B93A7] text-xs leading-relaxed font-sans">{feature.desc}</p>
                  </div>
                ))}
              </div>

              {/* Metrics strip banner beneath feature grid */}
              <div className="w-full max-w-4xl mx-auto py-6 px-8 rounded-2xl bg-[#161A23]/50 border border-zinc-800 flex flex-col md:flex-row justify-around items-center gap-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#6D5DFC]/10 text-[#8B7FFF] flex items-center justify-center">
                    <i className="ri-team-line text-lg"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white leading-none">5,000+</div>
                    <div className="text-[10px] font-bold text-[#8B93A7] mt-0.5">Happy Users</div>
                  </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-zinc-800"></div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#6D5DFC]/10 text-[#8B7FFF] flex items-center justify-center">
                    <i className="ri-file-list-3-line text-lg"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white leading-none">250K+</div>
                    <div className="text-[10px] font-bold text-[#8B93A7] mt-0.5">Documents Solved</div>
                  </div>
                </div>

                <div className="hidden md:block h-8 w-px bg-zinc-800"></div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#6D5DFC]/10 text-[#8B7FFF] flex items-center justify-center">
                    <i className="ri-global-line text-lg"></i>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white leading-none">100+</div>
                    <div className="text-[10px] font-bold text-[#8B93A7] mt-0.5">Languages Supported</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4 — HOW IT WORKS */}
            <div className="space-y-12 w-full max-w-4xl mx-auto">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-bold text-[#8B7FFF] uppercase tracking-widest">
                  Simple Workflow
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                  How It Works
                </h2>
                <p className="text-xs text-[#8B93A7] max-w-sm mx-auto leading-relaxed">
                  Go from raw course material to structured answers in four simple phases.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative text-left">
                {[
                  {
                    step: "01",
                    title: "Upload PDF",
                    desc: "Select homework PDF, quiz, or camera screenshot."
                  },
                  {
                    step: "02",
                    title: "AI Analysis",
                    desc: "Gemini scans layout structure, questions, and graphs."
                  },
                  {
                    step: "03",
                    title: "Generate Answers",
                    desc: "Scribbles equations and detailed explanations."
                  },
                  {
                    step: "04",
                    title: "Export & Share",
                    desc: "Download styled vector PDF answer keys."
                  }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col space-y-3 text-left relative bg-[#161A23] p-5 rounded-xl border border-zinc-800">
                    <span className="font-mono text-3xl font-extrabold text-[#6D5DFC]/20">
                      {item.step}
                    </span>
                    <h4 className="font-bold text-white text-sm tracking-tight">
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#8B93A7] leading-relaxed font-sans">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5 — EXAMPLE OUTPUT */}
            <div id="demo-section" className="scroll-mt-24 space-y-12 w-full max-w-4xl mx-auto">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-bold text-[#8B7FFF] uppercase tracking-widest">
                  High Precision Outputs
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                  Precision Showcase
                </h2>
                <p className="text-xs text-[#8B93A7] max-w-sm mx-auto leading-relaxed">
                  Compare a simulated physics question with our generated workspace solution.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 text-left">
                {/* Before: Question PDF Preview */}
                <div className="bg-[#161A23] border border-zinc-800 p-6 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
                    <span className="text-[10px] font-mono text-[#8B93A7] uppercase tracking-wider">Before: Raw Assignment PDF</span>
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[9px] font-bold rounded">Page 1</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 block mb-1">QUESTION 1</span>
                      <h4 className="font-bold text-zinc-200 text-sm leading-relaxed">
                        A 5kg block is placed on a rough 30° incline. If the coefficient of static friction is μs = 0.4, find the acceleration of the block.
                      </h4>
                    </div>
                    {/* Simulated SVG incline slide */}
                    <div className="h-32 border border-zinc-800 rounded-xl bg-[#0F1117] flex items-center justify-center overflow-hidden">
                      <svg width="220" height="100" viewBox="0 0 220 100" className="opacity-60">
                        {/* Ground */}
                        <line x1="10" y1="90" x2="210" y2="90" stroke="#27272a" strokeWidth="2" />
                        {/* Wedge Incline */}
                        <polygon points="20,90 180,90 180,30" fill="none" stroke="#52525b" strokeWidth="2" />
                        <text x="140" y="83" fill="#52525b" fontSize="8" fontWeight="bold">θ = 30°</text>
                        {/* Box block */}
                        <rect x="100" y="46" width="30" height="20" transform="rotate(-21 115 56)" fill="#1d2230" stroke="#71717a" strokeWidth="2" />
                        <text x="108" y="58" fill="#a1a1aa" fontSize="8" fontWeight="bold">5 kg</text>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* After: Generated Answers Preview */}
                <div className="bg-[#1D2230]/40 border border-[#6D5DFC]/30 p-6 rounded-2xl shadow-lg shadow-[#6D5DFC]/5">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4">
                    <span className="text-[10px] font-mono text-[#8B7FFF] uppercase tracking-wider">After: DocuSolver AI Output</span>
                    <span className="px-2 py-0.5 bg-[#6D5DFC]/10 text-[#8B7FFF] text-[9px] font-bold rounded">Structured View</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-950/20 border border-blue-900/40 text-blue-300 rounded-xl">
                      <span className="text-[8px] font-bold uppercase tracking-wider block text-blue-400">Given Values</span>
                      <div className="font-mono text-xs mt-1">m = 5kg, θ = 30°, μs = 0.4</div>
                    </div>
                    
                    <div className="p-3 bg-amber-950/20 border border-amber-900/40 text-amber-300 rounded-xl">
                      <span className="text-[8px] font-bold uppercase tracking-wider block text-amber-400">Formula</span>
                      <div className="font-mono text-xs mt-1">F_friction = μs * Fn = μs * m * g * cos(θ)</div>
                    </div>

                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 rounded-xl">
                      <span className="text-[8px] font-bold uppercase tracking-wider block text-emerald-400">Solution & Calculation</span>
                      <div className="font-mono text-xs mt-1">Fn = 5 * 9.8 * cos(30°) = 42.43 N</div>
                      <div className="font-mono text-xs mt-0.5">F_static_max = 0.4 * 42.43 = 16.97 N</div>
                      <div className="font-mono text-xs mt-0.5 text-white font-bold">F_gravity_slide = 5 * 9.8 * sin(30°) = 24.5 N</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 6 — TESTIMONIALS */}
            <div className="space-y-12 w-full max-w-4xl mx-auto">
              <div className="text-center space-y-3">
                <span className="text-[10px] font-bold text-[#8B7FFF] uppercase tracking-widest">
                  User Reviews
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
                  Saves Hours of Studying
                </h2>
                <p className="text-xs text-[#8B93A7] max-w-sm mx-auto leading-relaxed">
                  See what students and educators are saying about DocuSolver AI.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    name: "Alex Rivera",
                    role: "Physics Major, ASU",
                    text: "The diagram extraction is wild. It parsed a full thermodynamics test worksheet, found the graph coordinates, and solved it in seconds. Absolute lifesaver.",
                    rating: 5,
                    avatar: "AR"
                  },
                  {
                    name: "Dr. Sarah Chen",
                    role: "STEM Instructor",
                    text: "I use DocuSolver to generate structured answer keys for my weekly math quizzes. The multi-language output is essential for my bilingual classes.",
                    rating: 5,
                    avatar: "SC"
                  },
                  {
                    name: "Marcus Brody",
                    role: "AP Calculus Student",
                    text: "Being able to change explanation details helps so much when studying. I turn down the words to study calculations, and up when I need concepts explained.",
                    rating: 5,
                    avatar: "MB"
                  }
                ].map((t, idx) => (
                  <div key={idx} className="p-6 rounded-xl border border-zinc-800 bg-[#161A23] flex flex-col justify-between space-y-4 text-left">
                    <div className="space-y-3">
                      <div className="flex gap-1 text-amber-400">
                        {Array.from({ length: t.rating }).map((_, i) => (
                          <i key={i} className="ri-star-fill text-xs"></i>
                        ))}
                      </div>
                      <p className="text-[#B8C0CC] text-xs leading-relaxed font-sans">
                        "{t.text}"
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3 border-t border-zinc-800/80 pt-4">
                      <div className="w-8 h-8 rounded-full bg-[#1D2230] text-[#8B7FFF] flex items-center justify-center font-bold text-xs">
                        {t.avatar}
                      </div>
                      <div>
                        <h5 className="font-bold text-white text-xs">{t.name}</h5>
                        <p className="text-[10px] text-[#8B93A7]">{t.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 7 — FINAL CTA */}
            <div className="w-full max-w-4xl mx-auto p-12 rounded-2xl bg-gradient-to-r from-[#161A23] to-[#1D2230] border border-zinc-800 text-center space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#6D5DFC]/5 rounded-full blur-3xl pointer-events-none"></div>
              
              <h2 className="text-3xl font-extrabold text-white tracking-tight font-display">
                Ready to Solve Documents Instantly?
              </h2>
              <p className="text-sm text-[#B8C0CC] max-w-md mx-auto leading-relaxed">
                Connect your Gemini API Key and upload your first quiz to digitize homework solving today.
              </p>

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-[#6D5DFC] hover:bg-[#6D5DFC]/90 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-[#6D5DFC]/10 text-xs cursor-pointer"
                >
                  Start Free
                </button>
                <button 
                  onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-zinc-800/40 hover:bg-zinc-800 text-white border border-zinc-700/50 font-semibold px-6 py-3 rounded-xl transition-all text-xs cursor-pointer"
                >
                  Upload Your First PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {(processingState.status === ProcessingStatus.READING_PDF || 
          processingState.status === ProcessingStatus.ANALYZING) && (
          <ProcessingIndicator 
            status={processingState.status} 
            message={processingState.message} 
          />
        )}

        {processingState.status === ProcessingStatus.ERROR && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto text-center py-16 px-4"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-950/10 border border-rose-900/30 mb-6 text-rose-400 shadow-md">
              {processingState.message?.includes("image") ? (
                <i className="ri-file-warning-line text-4xl leading-none"></i>
              ) : (
                <i className="ri-alert-line text-4xl leading-none"></i>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white font-display tracking-tight mb-2">Extraction Obstacle</h2>
            <p className="text-[#B8C0CC] text-sm mb-10 max-w-sm mx-auto leading-relaxed">
              {processingState.message}
            </p>
            <div className="flex justify-center">
               <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleReset}
                className="px-8 py-3.5 bg-[#6D5DFC] text-white text-xs font-semibold uppercase tracking-wider rounded-xl hover:bg-[#6D5DFC]/90 transition-all cursor-pointer"
              >
                Reset Engine
              </motion.button>
            </div>
          </motion.div>
        )}

        {processingState.status === ProcessingStatus.COMPLETE && (
          <QAView 
            qaPairs={qaPairs} 
            onDownload={handleDownload} 
            onPreview={handlePreview}
            onReset={handleReset} 
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/60 py-12 mt-20 relative z-10 print:hidden bg-[#0F1117]">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <div className="bg-[#6D5DFC] p-1.5 rounded-lg text-white flex items-center justify-center">
              <i className="ri-cpu-line text-xs"></i>
            </div>
            <span className="text-xs font-bold text-white tracking-tight font-display">DocuSolver AI</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-xs font-semibold text-[#8B93A7]">
            <a href="#upload-section" className="hover:text-white transition-colors">Features</a>
            <a href="#upload-section" className="hover:text-white transition-colors">Pricing</a>
            <a href="#upload-section" className="hover:text-white transition-colors">Documentation</a>
            <a href="#upload-section" className="hover:text-white transition-colors">Contact</a>
          </div>

          {/* Socials */}
          <div className="flex items-center gap-4 text-[#8B93A7] text-sm">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="GitHub">
              <i className="ri-github-line"></i>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="LinkedIn">
              <i className="ri-linkedin-line"></i>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors" title="Twitter">
              <i className="ri-twitter-line"></i>
            </a>
          </div>
        </div>
        <div className="text-center text-[10px] text-zinc-600 mt-6 max-w-6xl mx-auto">
          &copy; {new Date().getFullYear()} DocuSolver AI. All rights reserved. Built for modern course workspaces.
        </div>
      </footer>
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />

    </div>

    {/* Printable Paper View — uses INLINE STYLES for html2canvas compatibility */}
    <div className="fixed left-[-9999px] top-0 w-[800px] pointer-events-none print:static print:w-auto print:pointer-events-auto" style={{ zIndex: -1 }}>
      <div id="printable-paper-view" style={{
        background: '#ffffff', color: '#000000', padding: '32px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: '14px', lineHeight: '1.6', textAlign: 'left', width: '100%', boxSizing: 'border-box'
      }}>
        {/* Document Header */}
        <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>DocuSolver AI — Answer Key</h1>
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', margin: '4px 0 0 0' }}>High-Precision Academic Extraction & Explanations</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
              <p style={{ margin: '0 0 2px 0' }}>Generated: {new Date().toLocaleDateString()}</p>
              <p style={{ margin: 0 }}>Language: {LANGUAGE_NATIVE_LABELS[language] ?? language}</p>
            </div>
          </div>
        </div>

        {/* Questions */}
        {qaPairs.map((pair, idx) => {
          const headerRegex = /^(Concept|Given|Find|Step \d+|Method \d+|Note|Explanation|Solution|Analysis|Answer|Conclusion|Summary|Final Answer|Formula|Calculation|Result):/i;

          return (
            <div key={idx} style={{
              borderBottom: idx < qaPairs.length - 1 ? '1px dashed #cbd5e1' : 'none',
              paddingBottom: '28px', marginBottom: '28px', pageBreakInside: 'avoid'
            }}>
              {/* Question Label */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: '#4f46e5', fontFamily: 'monospace', display: 'block', marginBottom: '4px'
                }}>
                  Question {idx + 1}
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.5 }}>
                  {pair.question}
                </h2>
              </div>

              {/* Images */}
              {pair.image && (
                <div style={{ margin: '16px 0', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'inline-block', maxWidth: '280px' }}>
                  <img src={pair.image} alt={`Q${idx + 1}`} style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '4px' }} />
                </div>
              )}

              {!pair.image && pair.diagram && (
                <div style={{ margin: '16px 0', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'inline-block', background: '#ffffff' }}>
                  <div dangerouslySetInnerHTML={{ __html: pair.diagram }} style={{ maxWidth: '100%', maxHeight: '200px', overflow: 'hidden' }} />
                </div>
              )}

              {/* Answer */}
              <div style={{ marginTop: '16px' }}>
                <h3 style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: '#64748b', marginBottom: '12px', fontFamily: 'monospace'
                }}>
                  Detailed Solution
                </h3>

                {pair.answer.split('\n').map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <div key={i} style={{ height: '6px' }} />;

                  const match = trimmed.match(headerRegex);
                  if (match) {
                    const [header] = match;
                    const content = trimmed.substring(header.length).trim();
                    const hLower = header.toLowerCase();
                    const isConclusion = hLower.includes('conclusion') || hLower.includes('final') || hLower.includes('result');
                    const isFormula = hLower.includes('formula');
                    const isCalculation = hLower.includes('calculation');

                    return (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: '8px', marginBottom: '8px',
                        border: `1px solid ${isConclusion ? '#a7f3d0' : isFormula ? '#fde68a' : isCalculation ? '#bae6fd' : '#e2e8f0'}`,
                        background: isConclusion ? '#ecfdf5' : isFormula ? '#fffbeb' : isCalculation ? '#f0f9ff' : '#f8fafc'
                      }}>
                        <span style={{
                          fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '8px',
                          color: isConclusion ? '#065f46' : isFormula ? '#92400e' : isCalculation ? '#075985' : '#0f172a'
                        }}>
                          {header.replace(':', '')}:
                        </span>
                        <span style={{
                          color: '#1e293b',
                          fontFamily: (isFormula || isCalculation) ? 'monospace' : 'inherit'
                        }}>{content}</span>
                      </div>
                    );
                  }

                  {/* Math equation lines */}
                  if (/^(=>|=\s)/.test(trimmed) || (trimmed.includes('=>') && /\d/.test(trimmed)) || (/^[A-Za-z_\d\s()]+\s*=\s*.+/.test(trimmed) && trimmed.length < 120)) {
                    return (
                      <div key={i} style={{
                        fontFamily: 'monospace', fontSize: '13px', color: '#334155', background: '#f8fafc',
                        border: '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '6px', marginBottom: '6px'
                      }}>
                        {trimmed.replace(/=>/g, ' → ')}
                      </div>
                    );
                  }

                  if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
                    return (
                      <div key={i} style={{ display: 'flex', gap: '8px', marginLeft: '16px', color: '#334155', marginBottom: '4px' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 700, userSelect: 'none' }}>•</span>
                        <span>{trimmed.replace(/^[-•*]\s+/, '')}</span>
                      </div>
                    );
                  }

                  return <div key={i} style={{ color: '#334155', paddingLeft: '4px', marginBottom: '4px' }}>{line}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
};

export default App;
