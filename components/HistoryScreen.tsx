import React from 'react';
import { HistoryEntry } from '../types';
import { BackIcon, TrashIcon, MoonIcon, SunIcon } from './icons';
import { useTheme } from '../hooks/useTheme';

interface HistoryScreenProps {
  history: HistoryEntry[];
  onDelete: (id: number) => void;
  onClear: () => void;
  onReEdit: (imageUri: string) => void;
  onBack: () => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ history, onDelete, onClear, onReEdit, onBack }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col h-full">
       <header className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><BackIcon className="w-6 h-6"/></button>
        <h2 className="font-bold text-lg">History</h2>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={history.length === 0}>
            <TrashIcon className="w-6 h-6 text-red-500"/>
          </button>
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
          </button>
        </div>
      </header>
      <main className="flex-1 p-4 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p className="text-xl">No saved images yet.</p>
            <p>Go back and edit an image to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {history.map(entry => (
              <div key={entry.id} className="group relative rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700">
                <img 
                  src={entry.dataUrl} 
                  alt={`Edited on ${new Date(entry.timestamp).toLocaleString()}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => onReEdit(entry.dataUrl)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all flex flex-col justify-between p-2">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600"
                    >
                      <TrashIcon className="w-4 h-4"/>
                    </button>
                  </div>
                  <div className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity self-start bg-black bg-opacity-50 rounded px-1 py-0.5">
                    <p>{new Date(entry.timestamp).toLocaleDateString()}</p>
                    <p>{new Date(entry.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryScreen;