
import React from 'react';

interface LoadingOverlayProps {
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-[0_40px_100px_rgba(0,0,0,0.3)] text-center space-y-8 relative overflow-hidden border border-white/50">
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-50 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-loading-bar" style={{ width: '40%' }}></div>
        </div>
        
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 border-8 border-slate-50 rounded-full"></div>
          <div className="absolute inset-0 border-8 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-4 bg-indigo-50 rounded-full flex items-center justify-center animate-pulse">
             <div className="w-6 h-6 bg-indigo-600 rounded-full"></div>
          </div>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Yapay Zeka Çalışıyor</h3>
          <p className="text-sm font-black text-slate-900 leading-relaxed px-4">{message}</p>
        </div>
        
        <div className="pt-4 flex justify-center gap-2">
           <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
           <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
           <span className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce"></span>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-loading-bar {
          animation: loading-bar 2s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
