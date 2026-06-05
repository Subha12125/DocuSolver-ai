import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ProcessingStatus } from '../types';

interface ProcessingIndicatorProps {
  status: ProcessingStatus;
  message?: string;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ status, message }) => {
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
        className="bg-zinc-900/50 rounded-3xl p-10 border border-zinc-800/80 shadow-2xl relative overflow-hidden"
      >
        {/* Decorative corner background lights */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-sky-500/15 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header Text */}
        <div className="text-center mb-12 space-y-3 relative z-10">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="inline-flex p-2 bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 rounded-xl mb-2"
          >
            <i className="ri-sparkling-fill text-lg"></i>
          </motion.div>
          <h3 className="text-2xl font-extrabold text-zinc-100 tracking-tight font-display">
            {activeStep === 3 ? 'Processing Complete!' : 'Analyzing Document'}
          </h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            {activeStep === 2 && status !== ProcessingStatus.COMPLETE 
              ? "Formulating step-by-step solutions with detailed logic..." 
              : message || "Please wait while our academic AI processes your document."}
          </p>
        </div>

        {/* Stepper Visual */}
        <div className="relative flex justify-between items-center mb-6 px-6">
          {/* Connecting Line Background */}
          <div className="absolute left-6 right-6 top-[22px] h-[3px] bg-zinc-800 rounded-full -z-10"></div>
          
          {/* Connecting Line Progress */}
          <motion.div 
            className="absolute left-6 top-[22px] h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full -z-10"
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
                      ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff', scale: 1 } 
                      : isActive 
                        ? { backgroundColor: '#09090b', borderColor: '#4f46e5', color: '#818cf8', scale: 1.15 } 
                        : { backgroundColor: '#18181b', borderColor: '#27272a', color: '#52525b', scale: 1 }
                  }
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 shadow-sm"
                >
                  {isCompleted ? (
                    <i className="ri-checkbox-circle-fill text-lg text-white"></i>
                  ) : isActive ? (
                    <i className="ri-loader-2-line text-lg animate-spin text-indigo-400"></i>
                  ) : (
                    <i className={`${step.iconClass} text-base`}></i>
                  )}
                </motion.div>
                
                <div className="absolute top-14 flex flex-col items-center">
                  <span 
                    className={`
                      text-xs font-bold whitespace-nowrap transition-colors duration-300 tracking-tight
                      ${isActive || isCompleted ? 'text-zinc-100 font-display' : 'text-zinc-500'}
                    `}
                  >
                    {step.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 hidden md:block whitespace-nowrap mt-0.5">
                    {step.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Padding for bottom aligned stepper details */}
        <div className="h-10"></div>
      </motion.div>
    </div>
  );
};

export default ProcessingIndicator;