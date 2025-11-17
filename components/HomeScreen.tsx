import React, { useRef } from 'react';
import { MoonIcon, SunIcon } from './icons';
import { useTheme } from '../hooks/useTheme';

interface HomeScreenProps {
  onImageSelect: (imageUri: string) => void;
  onViewHistory: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onImageSelect, onViewHistory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  const handleSelectImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageSelect(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 relative">
      <div className="absolute top-4 right-4">
        <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
          {theme === 'light' ? <MoonIcon className="w-6 h-6 text-gray-800 dark:text-gray-200" /> : <SunIcon className="w-6 h-6 text-gray-800 dark:text-gray-200" />}
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-600 dark:text-blue-400">EasyPix Editor</h1>
        <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">Quick and simple photo editing.</p>
      </div>
      <div className="mt-12 space-y-4 w-full max-w-xs">
        <button
          onClick={handleSelectImageClick}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          Select Image
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={onViewHistory}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-4 px-4 rounded-lg shadow-lg transition-transform transform hover:scale-105 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          View History
        </button>
      </div>
      <footer className="absolute bottom-4 text-center text-gray-400 dark:text-gray-500 text-sm">
        <p>All editing is done on your device. No data is uploaded.</p>
      </footer>
    </div>
  );
};

export default HomeScreen;