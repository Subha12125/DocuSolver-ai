import React from 'react';
import { BookOpenCheck, FileDown } from 'lucide-react';
import { motion } from 'motion/react';

const Header: React.FC = () => {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-900/80 transition-all duration-300"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        <div className="flex items-center space-x-3.5 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 p-2.5 rounded-2xl shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 transform group-hover:scale-105 active:scale-95">
            <BookOpenCheck className="w-5.5 h-5.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight font-display bg-gradient-to-r from-zinc-100 via-zinc-200 to-indigo-300 bg-clip-text text-transparent">
              DocuSolver AI
            </span>
            <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Question PDF to Answer PDF</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-emerald-950/20 border-emerald-900/40 text-emerald-400">
          <FileDown className="w-3.5 h-3.5" />
          <span>File-only workflow</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
