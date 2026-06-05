import React from 'react';
import { motion } from 'motion/react';

interface HeaderProps {
  apiKey: string;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  onClearKey: () => void;
}

const Header: React.FC<HeaderProps> = ({
  apiKey,
  onClearKey
}) => {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 w-full max-w-6xl mx-auto print:hidden"
    >
      <header 
        className="w-full rounded-[16px] h-16 flex items-center justify-between px-6 transition-all duration-300 liquid-glass-header border border-zinc-800/60"
      >
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-[#6D5DFC] p-2.5 rounded-xl transition-all duration-300 transform group-hover:scale-105 active:scale-95 flex items-center justify-center text-white shadow-sm shadow-[#6D5DFC]/20">
            <i className="ri-cpu-line text-base leading-none"></i>
          </div>
          <span className="text-sm font-bold tracking-tight font-display text-white">
            DocuSolver AI
          </span>
        </div>

        {/* Center navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#8B93A7]">
          <a href="#upload-section" onClick={(e) => { e.preventDefault(); document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">Features</a>
          <a href="#upload-section" onClick={(e) => { e.preventDefault(); document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">How It Works</a>
          <a href="#demo-section" onClick={(e) => { e.preventDefault(); document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">Examples</a>
          <a href="#upload-section" onClick={(e) => { e.preventDefault(); document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">Pricing</a>
          <a href="#upload-section" onClick={(e) => { e.preventDefault(); document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' }); }} className="hover:text-white transition-colors">Docs</a>
        </nav>

        {/* Right aligned status and controls */}
        <div className="flex items-center gap-4">
          {!apiKey ? null : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] rounded-xl text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
                <span className="hidden sm:inline">Connected</span>
              </div>
              <button 
                onClick={onClearKey} 
                className="w-8 h-8 flex items-center justify-center text-[#8B93A7] hover:text-rose-400 bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-700/40 rounded-xl transition-all shadow-sm" 
                title="Clear Session API Key"
              >
                <i className="ri-close-line leading-none text-base"></i>
              </button>
            </div>
          )}
        </div>
      </header>
    </motion.div>
  );
};

export default Header;
