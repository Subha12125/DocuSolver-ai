import React, { useRef, useState } from 'react';
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
    if (file.size > 15 * 1024 * 1024) {
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
        whileHover={disabled ? {} : { y: -2 }}
        whileTap={disabled ? {} : { scale: 0.99 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`
          relative border-2 border-dashed rounded-[16px] p-12 text-center transition-all duration-300 cursor-pointer overflow-hidden group
          ${disabled 
            ? 'opacity-40 cursor-not-allowed bg-[#161A23] border-[#1D2230]' 
            : 'bg-[#161A23] border-[#1D2230]'
          }
          ${isDragging 
            ? 'border-[#6D5DFC] bg-[#1D2230]/80 shadow-[0_0_20px_rgba(109,93,252,0.08)]' 
            : 'hover:border-zinc-700 hover:bg-[#1D2230]/40'
          }
        `}
      >
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
            animate={isDragging ? { scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] } : {}}
            transition={{ repeat: isDragging ? Infinity : 0, duration: 1.5, ease: "easeInOut" }}
            className={`
              p-4 rounded-xl transition-all duration-300 flex items-center justify-center w-14 h-14
              ${isDragging 
                ? 'bg-[#6D5DFC] text-white' 
                : 'bg-[#1D2230] text-[#8B93A7] group-hover:bg-[#6D5DFC]/10 group-hover:text-[#6D5DFC]'
              }
            `}
          >
            <i className="ri-file-text-line text-2xl leading-none"></i>
          </motion.div>
          
          <div className="space-y-2">
            <p className="text-base font-bold text-white tracking-tight font-display transition-colors">
              {isDragging ? 'Drop PDF to solve' : 'Drop your PDF here'}
            </p>
            <p className="text-xs text-[#8B93A7] max-w-sm mx-auto leading-relaxed font-sans">
              Supports scanned documents, homework sheets, quizzes, and assignments
            </p>
          </div>

          <div className="pt-2 flex flex-col items-center gap-3">
            <span className="px-4 py-2.5 bg-[#6D5DFC] hover:bg-[#6D5DFC]/90 text-white text-xs font-semibold rounded-xl transition-all shadow-sm">
              Choose File
            </span>
            
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#8B93A7] uppercase tracking-wider">
              <span>Max size: 15MB</span>
              <span className="text-[#1D2230]">•</span>
              <span>Format: PDF</span>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mt-4 flex items-center justify-center text-rose-400 bg-rose-950/10 border border-rose-900/30 p-4 rounded-2xl animate-fade-in"
          >
            <i className="ri-error-warning-line text-lg leading-none mr-2.5 flex-shrink-0 text-rose-400 animate-bounce"></i>
            <span className="text-xs font-semibold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;