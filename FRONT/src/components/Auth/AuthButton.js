import React from 'react';

const AuthButton = ({ onClick, children, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-200 ease-in-out ${className}`}
    >
      {children}
    </button>
  );
};

export default AuthButton;