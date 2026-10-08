import React from "react";
import { Search, X } from "lucide-react";

export const TableSearchBar = ({
  value,
  onChange,
  placeholder,
  totalResults,
  totalItems,
}) => (
  <div className="mb-4">
    <div className="relative flex items-center">
      <span className="absolute left-3.5 text-gray-400 dark:text-zinc-500 select-none pointer-events-none">
        <Search className="w-4 h-4" />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 transition-all shadow-sm outline-none placeholder-gray-400 dark:placeholder-zinc-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1 text-sm font-bold transition-colors cursor-pointer"
          title="Limpiar búsqueda"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
    {value && (
      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 ml-1">
        Mostrando <span className="font-semibold text-gray-700 dark:text-zinc-200">{totalResults}</span> de {totalItems} resultados encontrados
      </p>
    )}
  </div>
);

export default TableSearchBar;
