import React, { useState, useRef, useEffect } from 'react';
import { QAPair } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface QAViewProps {
  qaPairs: QAPair[];
  onDownload: () => void;
  onPreview: () => void;
  onReset: () => void;
}

type ViewMode = 'plain' | 'markdown' | 'structured';

const QAView: React.FC<QAViewProps> = ({ qaPairs, onDownload, onPreview, onReset }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('structured');
  const [expandedPairs, setExpandedPairs] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    qaPairs.forEach((_, idx) => {
      initial[idx] = true;
    });
    return initial;
  });
  const [showBackToTop, setShowBackToTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleExpand = (idx: number) => {
    setExpandedPairs(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const allExpanded = qaPairs.every((_, idx) => expandedPairs[idx] !== false);

  const toggleAll = () => {
    const newState: Record<number, boolean> = {};
    const shouldExpand = !allExpanded;
    qaPairs.forEach((_, idx) => {
      newState[idx] = shouldExpand;
    });
    setExpandedPairs(newState);
  };

  // Enhanced header regex with math-specific headers (no 'Concept:' — user wants direct answers)
  const headerRegex = /^(Given|Find|Step \d+|Method \d+|Note|Explanation|Solution|Analysis|Answer|Conclusion|Summary|Final Answer|Formula|Calculation|Result|দেওয়া আছে|দেয়া আছে|প্রদত্ত|ধাপ \d+|পদক্ষেপ \d+|নোট|ব্যাখ্যা|বিশ্লেষণ|সমাধান|উত্তর|উপসংহার|ফলাফল|সূত্র|গণনা|दिया है|ज्ञात है|चरण \d+|कदम \d+|नोट|स्पष्टीकरण|हल|निष्कर्ष|परिणाम|सूत्र|गणना):/i;

  // Detect math/equation lines: lines with = sign, arrows, or pure numeric expressions
  const isMathLine = (line: string): boolean => {
    const trimmed = line.trim();
    // Lines starting with = or => are calculation continuations
    if (/^(=>|=\s)/.test(trimmed)) return true;
    // Lines that are primarily equations: "F = m × a", "x = 5 + 3", etc.
    if (/^[A-Za-z_\d\s()]+\s*=\s*.+/.test(trimmed) && trimmed.length < 120) return true;
    // Lines with arrow chains
    if (trimmed.includes('=>') && /\d/.test(trimmed)) return true;
    return false;
  };

  // Detect numbered sub-steps: (i), (a), 1., 2., (1), etc.
  const isNumberedStep = (line: string): { marker: string; content: string } | null => {
    const match = line.trim().match(/^(\(\s*[ivxlcdm]+\s*\)|\(\s*[a-z]\s*\)|\(\s*\d+\s*\)|\d+[\.\)])\s+(.*)/i);
    if (match) return { marker: match[1], content: match[2] };
    return null;
  };

  const getHeaderStyle = (header: string) => {
    const hLower = header.toLowerCase();
    const isConclusion = hLower.includes('conclusion') || hLower.includes('final') || hLower.includes('result') || header.includes('উপসংহার') || header.includes('ফলাফল') || header.includes('निष्कर्ष') || header.includes('परिणाम');
    const isStep = hLower.includes('step') || header.includes('ধাপ') || header.includes('পদক্ষেপ') || header.includes('चरण') || header.includes('कदम');
    const isFormula = hLower.includes('formula') || header.includes('সূত্র') || header.includes('सूत्र');
    const isCalculation = hLower.includes('calculation') || header.includes('গণনা') || header.includes('गणना');
    const isGiven = hLower.includes('given') || hLower.includes('find') || header.includes('দেওয়া') || header.includes('দেয়া') || header.includes('প্রদত্ত') || header.includes('दिया') || header.includes('ज्ञात');

    if (isConclusion) return {
      card: 'bg-emerald-950/30 border-emerald-800/60 ring-1 ring-emerald-500/10',
      badge: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/40',
      text: 'font-semibold text-emerald-100',
      icon: '🎯'
    };
    if (isFormula) return {
      card: 'bg-amber-950/25 border-amber-800/50 ring-1 ring-amber-500/10',
      badge: 'bg-amber-900/50 text-amber-300 border border-amber-700/40',
      text: 'font-mono text-amber-200',
      icon: '📐'
    };
    if (isCalculation) return {
      card: 'bg-cyan-950/25 border-cyan-800/50 ring-1 ring-cyan-500/10',
      badge: 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/40',
      text: 'font-mono text-cyan-200',
      icon: '🧮'
    };
    if (isGiven) return {
      card: 'bg-blue-950/25 border-blue-800/50 ring-1 ring-blue-500/10',
      badge: 'bg-blue-900/50 text-blue-300 border border-blue-700/40',
      text: 'text-blue-200',
      icon: '📋'
    };
    if (isStep) return {
      card: 'bg-indigo-950/25 border-indigo-800/50',
      badge: 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/40',
      text: 'text-zinc-300',
      icon: ''
    };
    return {
      card: 'bg-zinc-900/50 border-zinc-800/60',
      badge: 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/40',
      text: 'text-zinc-300',
      icon: ''
    };
  };

  const renderStructuredAnswer = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines — add subtle spacing
      if (!trimmed) {
        elements.push(<div key={i} className="h-1.5" />);
        i++;
        continue;
      }

      // Header detection
      const match = trimmed.match(headerRegex);
      if (match) {
        const [header] = match;
        const content = trimmed.substring(header.length).trim();
        const style = getHeaderStyle(header);

        // Collect continuation lines for Given/Find (multi-line known values)
        const headerLower = header.toLowerCase();
        const isMultiLine = headerLower.includes('given') || headerLower.includes('find');
        const subLines: string[] = [];
        if (isMultiLine && content) subLines.push(content);
        if (isMultiLine) {
          let j = i + 1;
          while (j < lines.length) {
            const nextTrimmed = lines[j].trim();
            if (!nextTrimmed || nextTrimmed.match(headerRegex)) break;
            // Sub-values are typically indented or start with a variable/bullet
            if (nextTrimmed.startsWith('-') || nextTrimmed.startsWith('•') || /^[A-Za-z_\d\s()]+\s*=/.test(nextTrimmed) || /^\w/.test(nextTrimmed)) {
              subLines.push(nextTrimmed.replace(/^[-•]\s*/, ''));
              j++;
            } else {
              break;
            }
          }
          if (subLines.length > 0) {
            elements.push(
              <div key={i} className={`p-4 rounded-xl border transition-all duration-300 ${style.card}`}>
                <div className="flex items-center gap-2 mb-3">
                  {style.icon && <span className="text-sm">{style.icon}</span>}
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg ${style.badge}`}>
                    {header.replace(':', '')}
                  </span>
                </div>
                <div className="space-y-1.5 ml-1">
                  {subLines.map((sl, si) => (
                    <div key={si} className="flex items-start gap-2.5">
                      <span className="text-zinc-600 mt-1 text-[8px]">●</span>
                      <span className={`text-sm font-mono ${style.text}`}>{sl}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
            i = j;
            continue;
          }
        }

        elements.push(
          <div key={i} className={`p-4 rounded-xl border transition-all duration-300 ${style.card}`}>
            <div className="flex items-start gap-2">
              {style.icon && <span className="text-sm mt-0.5">{style.icon}</span>}
              <div className="flex-1">
                <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg mr-2.5 ${style.badge}`}>
                  {header.replace(':', '')}
                </span>
                <span className={`text-sm leading-relaxed ${style.text}`}>{content}</span>
              </div>
            </div>
          </div>
        );
        i++;
        continue;
      }

      // Math/equation lines — render in monospace accent card
      if (isMathLine(trimmed)) {
        // Collect consecutive math lines
        const mathLines: string[] = [trimmed];
        let j = i + 1;
        while (j < lines.length) {
          const nextTrimmed = lines[j].trim();
          if (isMathLine(nextTrimmed)) {
            mathLines.push(nextTrimmed);
            j++;
          } else {
            break;
          }
        }

        elements.push(
          <div key={i} className="bg-zinc-950/80 border border-zinc-800/70 rounded-xl p-4 font-mono text-sm space-y-1">
            {mathLines.map((ml, mi) => {
              // Highlight the arrow => parts
              const parts = ml.split(/(=>)/g);
              return (
                <div key={mi} className="text-violet-300/90 flex items-center gap-1 flex-wrap">
                  {parts.map((part, pi) => (
                    part === '=>'
                      ? <span key={pi} className="text-indigo-400 font-bold mx-1">→</span>
                      : <span key={pi}>{part}</span>
                  ))}
                </div>
              );
            })}
          </div>
        );
        i = j;
        continue;
      }

      // Numbered sub-steps — render as mini timeline
      const numStep = isNumberedStep(trimmed);
      if (numStep) {
        const steps: { marker: string; content: string }[] = [numStep];
        let j = i + 1;
        while (j < lines.length) {
          const nextStep = isNumberedStep(lines[j].trim());
          if (nextStep) {
            steps.push(nextStep);
            j++;
          } else {
            break;
          }
        }

        elements.push(
          <div key={i} className="space-y-0 ml-1">
            {steps.map((s, si) => (
              <div key={si} className="flex items-start gap-3 relative">
                {/* Timeline connector */}
                {si < steps.length - 1 && (
                  <div className="absolute left-[13px] top-7 w-px h-[calc(100%-4px)] bg-zinc-800" />
                )}
                <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg mt-0.5 relative z-10">
                  {s.marker.replace(/[().\s]/g, '')}
                </span>
                <p className="text-sm text-zinc-300 leading-relaxed pt-1 pb-3">{s.content}</p>
              </div>
            ))}
          </div>
        );
        i = j;
        continue;
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={i} className="flex gap-2.5 ml-3 text-zinc-400">
            <span className="text-indigo-500/60 select-none font-bold mt-0.5 text-xs">▸</span>
            <span className="text-sm leading-relaxed">{trimmed.replace(/^[-•*]\s+/, '')}</span>
          </div>
        );
        i++;
        continue;
      }

      // Default plain text line
      elements.push(
        <div key={i} className="text-zinc-400 text-sm leading-relaxed pl-1">{line}</div>
      );
      i++;
    }

    return <div className="space-y-2.5">{elements}</div>;
  };

  const renderMarkdownAnswer = (text: string) => {
     const formatted = text.split('\n').map(line => {
        if (headerRegex.test(line)) {
            const match = line.match(headerRegex);
            if (match) {
                return `**${match[1]}:** ${line.substring(match[0].length)}`;
            }
        }
        return line;
     }).join('\n');

     return (
        <pre className="font-mono text-xs text-zinc-300 bg-zinc-950 w-full p-5 rounded-xl border border-zinc-800/80 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
            {formatted}
        </pre>
     );
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Main container card */}
      <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800/80 shadow-2xl overflow-hidden">
        
        {/* Sticky Header Toolbar */}
        <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl px-6 sm:px-8 py-5 border-b border-zinc-800/60">
          
          {/* Top row: Status + Actions */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-3.5">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/15 text-emerald-400 flex items-center justify-center"
              >
                <i className="ri-checkbox-circle-fill text-xl"></i>
              </motion.div>
              <div>
                <h2 className="text-base font-bold text-zinc-100 font-display tracking-tight">Answers Prepared</h2>
                <p className="text-[11px] text-zinc-500 font-medium">{qaPairs.length} questions extracted</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onReset}
                className="px-3.5 py-2.5 text-[11px] font-bold text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 hover:text-zinc-200 rounded-xl focus:outline-none flex items-center transition-all"
              >
                <i className="ri-arrow-left-line text-sm mr-1.5"></i>
                Reset
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onPreview}
                className="px-3.5 py-2.5 text-[11px] font-bold text-indigo-400 bg-indigo-950/30 hover:bg-indigo-950/60 border border-indigo-900/50 rounded-xl focus:outline-none flex items-center transition-all"
                title="Preview PDF"
              >
                <i className="ri-eye-line text-sm mr-1.5"></i>
                Preview
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onDownload}
                className="px-4 py-2.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl focus:outline-none shadow-md shadow-indigo-600/10 flex items-center transition-all"
                title="Download PDF"
              >
                <i className="ri-file-download-line text-sm mr-1.5"></i>
                Download PDF
              </motion.button>
            </div>
          </div>

          {/* Bottom row: View mode switcher + Expand/Collapse */}
          <div className="flex items-center justify-between mt-4 gap-3">
            {/* View Mode Switcher */}
            <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800/60 flex items-center space-x-1 flex-shrink-0">
               {[
                 { id: 'structured', iconClass: 'ri-layout-grid-line', label: 'Structured' },
                 { id: 'plain', iconClass: 'ri-align-left', label: 'Plain' },
                 { id: 'markdown', iconClass: 'ri-file-code-line', label: 'Raw' }
               ].map((opt) => (
                 <button
                    key={opt.id}
                    onClick={() => setViewMode(opt.id as ViewMode)}
                    className={`relative flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-[11px] font-bold tracking-tight transition-colors ${
                      viewMode === opt.id 
                        ? 'text-indigo-400' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                 >
                    {viewMode === opt.id && (
                      <motion.div
                        layoutId="activeViewTab"
                        className="absolute inset-0 bg-zinc-900 rounded-lg shadow-sm border border-zinc-800/85"
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                      />
                    )}
                    <i className={`${opt.iconClass} text-sm relative z-10`}></i>
                    <span className="relative z-10 hidden sm:inline">{opt.label}</span>
                 </button>
               ))}
            </div>

            {/* Expand/Collapse All */}
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-2 rounded-lg hover:bg-zinc-900/50 flex-shrink-0"
            >
              <i className="ri-arrow-up-down-line text-sm"></i>
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          </div>
        </div>

        {/* Questions Body — no max-height constraint, full page flow */}
        <div className="divide-y divide-zinc-800/50">
          {qaPairs.length === 0 ? (
            <div className="p-16 text-center text-zinc-500 font-medium">
              No questions were extracted. Please ensure your PDF contains high-contrast text layout.
            </div>
          ) : (
            qaPairs.map((pair, idx) => {
              const isExpanded = expandedPairs[idx] !== false;
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3) }}
                  className={`transition-colors duration-200 ${
                    isExpanded ? 'bg-zinc-900/20' : 'bg-transparent hover:bg-zinc-900/10'
                  }`}
                >
                  {/* Question Header */}
                  <div 
                    onClick={() => toggleExpand(idx)}
                    className="px-6 sm:px-8 py-5 flex items-start gap-4 cursor-pointer select-none group"
                  >
                    {/* Question Number Badge */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className={`w-9 h-9 flex items-center justify-center font-extrabold rounded-xl text-xs shadow-sm transition-all duration-200 ${
                        isExpanded 
                          ? 'bg-indigo-600 text-white shadow-indigo-600/20 scale-105' 
                          : 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40 group-hover:bg-indigo-950/80'
                      }`}>
                        {idx + 1}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm tracking-tight leading-relaxed transition-colors ${
                        isExpanded ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100'
                      }`}>
                        {pair.question}
                      </h3>
                    </div>

                    <div className={`flex-shrink-0 mt-1 transition-all duration-200 p-1.5 rounded-lg flex items-center justify-center ${
                      isExpanded 
                        ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-900/30' 
                        : 'text-zinc-600 bg-zinc-900 border border-zinc-800 group-hover:text-zinc-400'
                    }`}>
                      {isExpanded ? <i className="ri-chevron-down-line text-sm"></i> : <i className="ri-chevron-right-line text-sm"></i>}
                    </div>
                  </div>

                  {/* Answer Panel */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 sm:px-8 pb-6 pl-[4.25rem] sm:pl-[4.75rem] space-y-4">
                          {/* Visual Assets rendering */}
                          {pair.image && (
                            <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex justify-center shadow-sm max-w-lg">
                              <img src={pair.image} alt="Extracted content asset" className="max-w-full max-h-56 object-contain rounded-xl" />
                            </div>
                          )}

                          {!pair.image && pair.diagram && (
                            <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl flex justify-center shadow-sm max-w-lg group/dia hover:border-indigo-900/50 transition-colors" title="Interactive Diagram">
                               <div dangerouslySetInnerHTML={{ __html: pair.diagram }} className="max-w-full max-h-56 overflow-auto" />
                            </div>
                          )}

                          {/* Answer Content */}
                          <div className="bg-zinc-900/30 border border-zinc-800/60 p-5 sm:p-6 rounded-2xl shadow-sm">
                            {viewMode === 'plain' && (
                              <p className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed">
                                {pair.answer}
                              </p>
                            )}

                            {viewMode === 'markdown' && renderMarkdownAnswer(pair.answer)}

                            {viewMode === 'structured' && renderStructuredAnswer(pair.answer)}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Back to Top */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 w-11 h-11 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/20 transition-colors"
            title="Back to top"
          >
            <i className="ri-arrow-up-line text-xl"></i>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QAView;