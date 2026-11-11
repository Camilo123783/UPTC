import React from 'react';

const AuthInput = ({ id, type = 'text', placeholder, value, onChange, label, disabled = false, required = false, maxLength, ...rest }) => {
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out disabled:opacity-60"
        {...rest}
      />
    </div>
  );
};

export default AuthInput;