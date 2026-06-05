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
            
            {/* Elegant Hero Text */}
            <motion.div 
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="text-center space-y-4 max-w-2xl mx-auto"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                <span>Powered by Gemini 2.5 Flash</span>
              </div>
              
              <h1 className="text-4xl sm:text-5.5xl font-extrabold text-zinc-100 tracking-tight leading-none font-display">
                Convert School Sheets to <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-indigo-500 to-violet-400 animate-pulse">
                  Polished Answer Keys
                </span>
              </h1>
              <p className="text-base sm:text-lg text-zinc-400 leading-relaxed font-sans max-w-xl mx-auto">
                No more manual typing or guessing. Drop exams, homework worksheets, or raw question sheets to extract, layout, and solve immediately.
              </p>
            </motion.div>

            <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                {!apiKey ? (
                  <form
                    onSubmit={handleApiKeySubmit}
                    className="w-full max-w-xl mx-auto bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden animate-neon-glow animate-light-sweep"
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="bg-indigo-950/40 border border-indigo-900/40 p-2.5 rounded-2xl text-indigo-400 flex items-center justify-center">
                        <i className="ri-key-2-line text-lg leading-none"></i>
                      </div>
                      <div>
                        <label htmlFor="gemini-api-key" className="font-bold text-zinc-100 text-sm font-display tracking-tight block">Gemini API Key Required</label>
                        <p className="text-xs text-zinc-500">Add your key before PDF processing starts</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        id="gemini-api-key"
                        type="password"
                        value={apiKeyInput}
                        onChange={(event) => setApiKeyInput(event.target.value)}
                        placeholder="Paste your Gemini API key"
                        autoComplete="off"
                        className="min-w-0 flex-1 bg-zinc-950 text-zinc-100 placeholder-zinc-600 text-sm px-4 py-3.5 rounded-2xl border border-zinc-800/80 focus:outline-none focus:border-indigo-600 transition-colors"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold uppercase tracking-widest px-5 py-3.5 rounded-2xl transition-colors shadow-lg shadow-indigo-600/10"
                      >
                        <i className="ri-shield-check-line text-base"></i>
                        Save Key
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                {/* Advanced Parameters Controller Card */}
                <motion.div 
                  whileHover={{ y: -1 }}
                  className="w-full max-w-xl mx-auto bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-950/40 border border-indigo-900/40 p-2.5 rounded-2xl text-indigo-400 flex items-center justify-center">
                        <i className="ri-equalizer-line text-lg leading-none"></i>
                      </div>
                      <div>
                        <label htmlFor="word-limit" className="font-bold text-zinc-100 text-sm font-display tracking-tight block">Target Explanation Detail</label>
                        <p className="text-xs text-zinc-500">Instruct Gemini on requested resolution length</p>
                      </div>
                    </div>
                    <motion.span 
                      key={wordLimit}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-indigo-600 text-white text-xs font-extrabold px-3.5 py-1.5 rounded-full shadow-md shadow-indigo-600/10 font-mono"
                    >
                      ~{wordLimit} words
                    </motion.span>
                  </div>
                  
                  <input
                    id="word-limit"
                    type="range"
                    min="50"
                    max="500"
                    step="10"
                    value={wordLimit}
                    onChange={(e) => setWordLimit(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700 transition-all"
                  />
                  
                  <div className="flex justify-between text-[10px] font-extrabold text-zinc-500 mt-3 px-1 uppercase tracking-wider font-mono">
                    <span>Brief (50)</span>
                    <span>Standard (250)</span>
                    <span>Comprehensive (500)</span>
                  </div>
                </motion.div>

                {/* Target Language Selection Tab Controller */}
                <motion.div 
                  whileHover={{ y: -1 }}
                  className="w-full max-w-xl mx-auto bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/80 shadow-2xl relative overflow-hidden animate-fade-in"
                >
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-950/40 border border-indigo-900/40 p-2.5 rounded-2xl text-indigo-400 flex items-center justify-center">
                        <i className="ri-translate-2 text-lg leading-none"></i>
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-100 text-sm font-display tracking-tight block">Target Explanation Language</h4>
                        <p className="text-xs text-zinc-500">Choose the language script for your explanations</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-1 bg-zinc-950/80 rounded-2xl border border-zinc-800/60 font-sans">
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
                          className={`relative py-3.5 px-1.5 rounded-xl text-center transition-colors duration-250 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 flex flex-col items-center justify-center select-none ${
                            isSelected 
                              ? 'text-indigo-400' 
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="activeLanguageTab"
                              className="absolute inset-0 bg-zinc-900 rounded-xl shadow-md border border-zinc-800"
                              transition={{ type: "spring", stiffness: 380, damping: 28 }}
                            />
                          )}
                          <span className="relative z-10 text-xs font-extrabold tracking-tight leading-none">{LANGUAGE_NATIVE_LABELS[lang.id] ?? lang.native}</span>
                          <span className="relative z-10 text-[9px] text-zinc-500 font-medium tracking-tight mt-1">{lang.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                <div>
                  <FileUpload 
                    onFileSelect={handleFileSelect} 
                    disabled={false} 
                  />
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setApiKey('');
                      setApiKeyInput('');
                      addToast("Gemini API key cleared", "info");
                    }}
                    className="text-xs font-semibold text-zinc-500 hover:text-indigo-400 transition-colors"
                  >
                    Change Gemini API Key
                  </button>
                </div>
                  </>
                )}
              </motion.div>

            {/* Polished Bento Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 pt-6">
              {[
                {
                  title: "Smart Segmentation",
                  desc: "Intelligently extracts core questions while ignoring clutter, headers, and footer credits completely.",
                  iconClass: "ri-file-question-line",
                  color: "from-indigo-500 to-blue-500",
                  bg: "bg-indigo-950/45 text-indigo-400 border-indigo-900/40"
                },
                {
                  title: "High Precision Logic",
                  desc: "Generates correct answers using state of the art context learning and academic rule validation.",
                  iconClass: "ri-cpu-line",
                  color: "from-violet-500 to-purple-500",
                  bg: "bg-violet-950/45 text-violet-400 border-violet-900/40"
                },
                {
                  title: "Clean Export System",
                  desc: "Compiles solutions, questions, and original diagrams back into perfectly formatted PDFs.",
                  iconClass: "ri-file-download-line",
                  color: "from-emerald-500 to-teal-500",
                  bg: "bg-emerald-950/45 text-emerald-400 border-emerald-900/40"
                }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 + (i * 0.08), ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -5, scale: 1.015 }}
                  className="bg-zinc-900/30 p-7 rounded-3xl border border-zinc-800 shadow-2xl hover:border-zinc-700 hover:shadow-indigo-500/5 transition-all duration-300"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border ${item.bg}`}>
                    <i className={`${item.iconClass} text-xl leading-none`}></i>
                  </div>
                  <h3 className="font-bold text-zinc-100 mb-2.5 text-base tracking-tight font-display">{item.title}</h3>
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
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
