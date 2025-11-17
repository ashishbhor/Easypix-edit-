import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 1s ease-in-out;
        }
      `}</style>
      
      <svg
        className="w-24 h-24 text-blue-500 dark:text-blue-400 mb-4"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
      >
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: 'rgb(59, 130, 246)', stopOpacity: 1}} /> 
            <stop offset="100%" style={{stopColor: 'rgb(147, 197, 253)', stopOpacity: 1}} />
            </linearGradient>
        </defs>
        <g stroke="url(#logoGradient)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M50 15 A 35 35 0 1 1 50 85 A 35 35 0 1 1 50 15 Z" />
            <path d="M50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z" />
            <path d="M25 35 L40 50" />
            <path d="M75 35 L60 50" />
            <path d="M25 65 L40 50" />
            <path d="M75 65 L60 50" />
            <path d="M50 20 L50 30" />
            <path d="M50 80 L50 70" />
            <path d="M20 50 L30 50" />
            <path d="M80 50 L70 50" />
        </g>
      </svg>

      <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 tracking-wider">
        Easy<span className="text-blue-500 dark:text-blue-400">Pix</span>
      </h1>
    </div>
  );
};

export default SplashScreen;
