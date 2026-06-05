import React from 'react';
import { motion } from 'motion/react';

const Header: React.FC = () => {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto print:hidden"
    >
      <header 
        className="w-full rounded-[24px] h-16 flex items-center justify-between px-6 transition-all duration-300 liquid-glass-header animate-light-sweep"
      >
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 p-2 rounded-xl shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all duration-300 transform group-hover:scale-105 active:scale-95 flex items-center justify-center">
            <i className="ri-book-open-fill text-base text-white leading-none"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight font-display bg-gradient-to-r from-zinc-100 via-zinc-200 to-indigo-300 bg-clip-text text-transparent">
              DocuSolver AI
            </span>
            <span className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Question PDF to Answer PDF</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-emerald-950/20 border-emerald-900/30 text-emerald-400">
          <i className="ri-file-download-line text-sm"></i>
          <span>File-only workflow</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </header>
    </motion.div>
  );
};

export default Header;
