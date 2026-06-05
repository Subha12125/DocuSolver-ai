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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden min-h-screen bg-zinc-950 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative">
      {/* Dynamic atmospheric ambient lights */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-1/4 w-[450px] h-[450px] bg-violet-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {processingState.status === ProcessingStatus.IDLE && (
          <div className="space-y-16">
            
            {/* Redesigned Premium Workspace Layout */}
            <div className="grid lg:grid-cols-12 gap-8 items-stretch pt-4">
              
              {/* Left Side: Product Copy + Workspace Controls */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
                
                {/* Brand Copy Block */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase shadow-sm w-fit">
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                    </span>
                    <span>DocuSolver AI 2.0</span>
                  </div>
                  
                  <h1 className="text-4xl font-extrabold text-zinc-100 tracking-tight leading-[1.15] font-display">
                    Document analysis, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-400 to-violet-300">
                      solved.
                    </span>
                  </h1>
                  
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
                    Upload any academic PDF, quiz, or homework sheet. Automatically extract questions from text or diagrams, generate structured pointwise solutions, and export as vector PDFs.
                  </p>
                </div>

                {/* Unified Control Panel */}
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-850 shadow-2xl relative overflow-hidden animate-neon-glow animate-light-sweep flex-1 flex flex-col justify-center min-h-[300px]">
                  {!apiKey ? (
                    <form onSubmit={handleApiKeySubmit} className="space-y-5">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-950/40 border border-indigo-900/40 p-2.5 rounded-2xl text-indigo-400 flex items-center justify-center">
                          <i className="ri-key-2-line text-lg leading-none"></i>
                        </div>
                        <div>
                          <h4 className="font-bold text-zinc-100 text-sm font-display tracking-tight block">Gemini API Key Required</h4>
                          <p className="text-xs text-zinc-500">Your key stays local in your browser session</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <input
                          id="gemini-api-key"
                          type="password"
                          value={apiKeyInput}
                          onChange={(event) => setApiKeyInput(event.target.value)}
                          placeholder="Paste your Gemini API key"
                          autoComplete="off"
                          className="w-full bg-zinc-950 text-zinc-100 placeholder-zinc-650 text-sm px-4 py-3.5 rounded-2xl border border-zinc-850 focus:outline-none focus:border-indigo-600 transition-colors"
                        />
                        <button
                          type="submit"
                          className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-widest py-4 rounded-2xl transition-colors shadow-lg shadow-indigo-600/10 active:scale-95"
                        >
                          <i className="ri-shield-check-line text-base"></i>
                          Initialize Workspace
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 text-center">
                        Don't have a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Get a free key here ↗</a>
                      </p>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      {/* Configuration header */}
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-800/80">
                        <span className="text-xs font-bold text-zinc-400 font-display uppercase tracking-wider">Workspace Config</span>
                        <button
                          onClick={() => {
                            setApiKey('');
                            setApiKeyInput('');
                            addToast("Gemini API key cleared", "info");
                          }}
                          className="text-[10px] font-bold text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                        >
                          <i className="ri-key-2-line"></i> Change Key
                        </button>
                      </div>

                      {/* Detail slider */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label htmlFor="word-limit" className="font-bold text-zinc-200 text-xs tracking-tight">Explanation Length</label>
                          <span className="bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
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
                          className="w-full h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-600 transition-all"
                        />
                        <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                          <span>Brief</span>
                          <span>Standard</span>
                          <span>Detailed</span>
                        </div>
                      </div>

                      {/* Language selection grid */}
                      <div className="space-y-3">
                        <label className="font-bold text-zinc-200 text-xs tracking-tight block">Output Language</label>
                        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-2xl border border-zinc-850 font-sans max-h-40 overflow-y-auto scrollbar-thin">
                          {[
                            { id: 'english', label: 'English', native: 'English' },
                            { id: 'bengali', label: 'Bengali', native: 'বাংলা' },
                            { id: 'banglish', label: 'Banglish', native: 'বাংলা + Eng' },
                            { id: 'hindi', label: 'Hindi', native: 'हिन्दी' },
                            { id: 'hinglish', label: 'Hinglish', native: 'Hinglish' },
                            { id: 'tamil', label: 'Tamil', native: 'Tamil' },
                            { id: 'telugu', label: 'Telugu', native: 'Telugu' },
                            { id: 'marathi', label: 'Marathi', native: 'Marathi' },
                            { id: 'gujarati', label: 'Gujarati', native: 'Gujarati' },
                            { id: 'kannada', label: 'Kannada', native: 'Kannada' },
                          ].map((lang) => {
                            const isSelected = language === lang.id;
                            return (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => setLanguage(lang.id)}
                                className={`relative py-2 px-3 rounded-xl text-left transition-colors duration-200 focus:outline-none flex flex-col justify-center select-none ${
                                  isSelected 
                                    ? 'text-indigo-400 bg-zinc-900 border border-zinc-800' 
                                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                                }`}
                              >
                                <span className="text-xs font-bold leading-none">{LANGUAGE_NATIVE_LABELS[lang.id] ?? lang.native}</span>
                                <span className="text-[8px] text-zinc-500 font-medium tracking-tight mt-0.5">{lang.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Upload Box */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className={`h-full flex flex-col justify-center min-h-[360px] ${!apiKey ? 'pointer-events-none opacity-50 relative' : ''}`}>
                  {!apiKey && (
                    <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-[1px] rounded-3xl z-20 flex items-center justify-center p-6 text-center">
                      <div className="bg-zinc-900/90 border border-zinc-800 p-6 rounded-2xl max-w-xs shadow-xl space-y-2.5">
                        <i className="ri-lock-line text-2xl text-indigo-400"></i>
                        <h4 className="text-sm font-bold text-zinc-150 font-display">Upload Locked</h4>
                        <p className="text-xs text-zinc-400">Initialize your workspace with a Gemini key on the left to unlock uploads.</p>
                      </div>
                    </div>
                  )}
                  <FileUpload 
                    onFileSelect={handleFileSelect} 
                    disabled={!apiKey} 
                  />
                </div>
              </div>

            </div>

            {/* Minimalist SaaS Product Feature Strip */}
            <div className="grid md:grid-cols-3 gap-8 pt-12 border-t border-zinc-900/60">
              {[
                {
                  title: "Multimodal AI Core",
                  desc: "Intelligently extracts formulas, charts, diagrams, and scanned texts.",
                  iconClass: "ri-cpu-line"
                },
                {
                  title: "High-Fidelity PDF",
                  desc: "Programmatic jsPDF vector rendering with searchable and selectable text.",
                  iconClass: "ri-file-download-line"
                },
                {
                  title: "Structured Outputs",
                  desc: "Rigorous step-by-step pointwise answers styled for study key structures.",
                  iconClass: "ri-file-question-line"
                }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <i className={`${item.iconClass} text-lg leading-none`}></i>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-200 text-sm font-display tracking-tight">{item.title}</h4>
                    <p className="text-zinc-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
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
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-950/20 border border-rose-900/40 mb-6 text-rose-400 shadow-md">
              {processingState.message?.includes("image") ? (
                <i className="ri-file-warning-line text-4xl leading-none"></i>
              ) : (
                <i className="ri-alert-line text-4xl leading-none"></i>
              )}
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 font-display tracking-tight mb-2">Extraction Obstacle</h2>
            <p className="text-zinc-400 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
              {processingState.message}
            </p>
            <div className="flex justify-center">
               <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleReset}
                className="px-8 py-3.5 bg-indigo-600 text-white text-xs font-extrabold uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10"
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
