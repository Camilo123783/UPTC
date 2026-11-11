import React from 'react';

const AuthButton = ({ onClick, children, className = '', type = 'button', disabled = false, ...rest }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-200 ease-in-out disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export default AuthButton;