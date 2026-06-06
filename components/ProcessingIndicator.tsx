import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ProcessingStatus } from '../types';

interface ProcessingIndicatorProps {
  status: ProcessingStatus;
  message?: string;
  progress?: number;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ status, message, progress }) => {
  const [activeStep, setActiveStep] = useState(0);

  // Map high-level status to visual steps
  useEffect(() => {
    if (status === ProcessingStatus.READING_PDF) {
      setActiveStep(0);
    } else if (status === ProcessingStatus.ANALYZING) {
      setActiveStep(1);
      const timer = setTimeout(() => {
        setActiveStep(2);
      }, 3500);
      return () => clearTimeout(timer);
    } else if (status === ProcessingStatus.COMPLETE) {
      setActiveStep(3);
    }
  }, [status]);

  if (status === ProcessingStatus.IDLE || status === ProcessingStatus.ERROR) return null;

  const steps = [
    { label: 'Reading PDF', desc: 'Validating structure', iconClass: 'ri-file-text-line' },
    { label: 'Analyzing Content', desc: 'Locating questions', iconClass: 'ri-search-line' },
    { label: 'Generating Answers', desc: 'Scribbling solutions', iconClass: 'ri-pen-nib-line' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto py-16 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#161A23] rounded-2xl p-10 border border-zinc-800 shadow-2xl relative overflow-hidden"
      >
        {/* Decorative corner background lights */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#6D5DFC]/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#8B7FFF]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Header Text */}
        <div className="text-center mb-12 space-y-3 relative z-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="inline-flex p-2 bg-[#6D5DFC]/10 text-[#8B7FFF] border border-[#6D5DFC]/20 rounded-xl mb-2"
          >
            <i className="ri-sparkling-fill text-lg"></i>
          </motion.div>
          <h3 className="text-xl font-bold text-white tracking-tight font-display">
            {activeStep === 3 ? 'Processing Complete!' : 'Analyzing Document'}
          </h3>
          <p className="text-[#B8C0CC] text-xs max-w-md mx-auto leading-relaxed font-sans">
            {activeStep === 2 && status !== ProcessingStatus.COMPLETE 
              ? "Formulating step-by-step solutions with detailed logic..." 
              : message || "Please wait while our academic AI processes your document."}
          </p>
        </div>

        {/* Stepper Visual */}
        <div className="relative flex justify-between items-center mb-6 px-6">
          {/* Connecting Line Background */}
          <div className="absolute left-6 right-6 top-[22px] h-[3px] bg-[#1D2230] rounded-full -z-10"></div>
          
          {/* Connecting Line Progress */}
          <motion.div 
            className="absolute left-6 top-[22px] h-[3px] bg-gradient-to-r from-[#6D5DFC] to-[#8B7FFF] rounded-full -z-10"
            initial={{ width: "0%" }}
            animate={{ 
              width: `calc(${Math.min((activeStep / (steps.length - 1)) * 100, 100)}% - 12px)`
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          ></motion.div>

          {steps.map((step, index) => {
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;

            return (
              <div key={index} className="flex flex-col items-center relative group">
                <motion.div 
                  initial={false}
                  animate={
                    isCompleted 
                      ? { backgroundColor: '#6D5DFC', borderColor: '#6D5DFC', color: '#ffffff', scale: 1 } 
                      : isActive 
                        ? { backgroundColor: '#161A23', borderColor: '#6D5DFC', color: '#8B7FFF', scale: 1.15 } 
                        : { backgroundColor: '#1D2230', borderColor: '#27272a', color: '#8B93A7', scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 shadow-sm"
                >
                  {isCompleted ? (
                    <i className="ri-checkbox-circle-fill text-lg text-white"></i>
                  ) : isActive ? (
                    <i className="ri-loader-2-line text-lg animate-spin text-[#8B7FFF]"></i>
                  ) : (
                    <i className={`${step.iconClass} text-base`}></i>
                  )}
                </motion.div>
                
                <div className="absolute top-14 flex flex-col items-center">
                  <span 
                    className={`
                      text-xs font-bold whitespace-nowrap transition-colors duration-300 tracking-tight
                      ${isActive || isCompleted ? 'text-white font-display' : 'text-[#8B93A7]'}
                    `}
                  >
                    {step.label}
                  </span>
                  <span className="text-[10px] text-[#8B93A7] hidden md:block whitespace-nowrap mt-0.5 font-sans">
                    {step.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {progress !== undefined && (
          <div className="mt-10 space-y-2.5 max-w-md mx-auto">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#8B93A7] px-1">
              <span>Solving Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 w-full bg-[#1D2230] rounded-full overflow-hidden border border-zinc-800/40 relative">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#6D5DFC] to-[#8B7FFF] rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
        
        {/* Padding for bottom aligned stepper details */}
        <div className="h-10"></div>
      </motion.div>
    </div>
  );
};

export default ProcessingIndicator;