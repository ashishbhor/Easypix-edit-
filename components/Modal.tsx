import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
        <button onClick={onClose} className="mt-4 w-full text-center p-2 text-gray-600 bg-gray-100 rounded dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
          Close
        </button>
      </div>
    </div>
  );
};

export default Modal;
