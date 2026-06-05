import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file containing selectable questions.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) { // Increased to 15MB limit
      setError('File size exceeds 15MB limit.');
      return;
    }
    setError(null);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={disabled ? {} : { scale: 1.015, y: -2 }}
        whileTap={disabled ? {} : { scale: 0.985 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`
          relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 cursor-pointer overflow-hidden group
          ${disabled ? 'opacity-40 cursor-not-allowed bg-zinc-900/40 border-zinc-900' : 'bg-zinc-900/30 border-zinc-800/80'}
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-950/20 ring-4 ring-indigo-500/15 shadow-xl shadow-indigo-500/10' 
            : 'hover:border-zinc-700 hover:shadow-2xl hover:shadow-indigo-500/5'
          }
        `}
      >
        {/* Modern ambient radial glow on drag */}
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_65%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none -z-10`} />

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center justify-center space-y-5">
          <motion.div 
            animate={isDragging ? { y: [0, -10, 0], scale: 1.1 } : {}}
            transition={{ repeat: isDragging ? Infinity : 0, duration: 1.2, ease: "easeInOut" }}
            className={`
              p-5 rounded-2xl transition-all duration-300 transform
              ${isDragging 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
                : 'bg-zinc-800 text-zinc-400 group-hover:bg-indigo-950/40 group-hover:text-indigo-400 group-hover:shadow-lg group-hover:shadow-indigo-500/15'
              }
            `}
          >
            {isDragging ? (
              <Upload className="w-8 h-8" />
            ) : (
              <FileText className="w-8 h-8 transition-transform group-hover:rotate-3" />
            )}
          </motion.div>
          
          <div className="space-y-2">
            <p className="text-lg font-bold text-zinc-100 font-display tracking-tight group-hover:text-indigo-400 transition-colors">
              {isDragging ? 'Drop your document here' : 'Select or drop your PDF'}
            </p>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Drop quizzes, homework sheets, or scanned documents to generate complete, high-fidelity answers.
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800/80 rounded-full text-xs font-semibold text-zinc-500 group-hover:border-indigo-900/50 group-hover:bg-indigo-950/40 group-hover:text-indigo-400 transition-all">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PDF files up to 15MB</span>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mt-4 flex items-center justify-center text-rose-400 bg-rose-950/20 border border-rose-900/40 p-4 rounded-2xl"
          >
            <AlertCircle className="w-5 h-5 mr-2.5 flex-shrink-0 text-rose-500 animate-bounce" />
            <span className="text-sm font-semibold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;