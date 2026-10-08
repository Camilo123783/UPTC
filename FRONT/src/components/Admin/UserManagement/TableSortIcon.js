import React from "react";

export const TableSortIcon = ({ currentKey, config, label }) => {
  let icon = "⇅";
  if (config && config.key === currentKey) {
    icon = config.direction === "ascending" ? "⬆️" : "⬇️";
  }
  return (
    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
      {label} <span className="text-lg">{icon}</span>
    </span>
  );
};

export default TableSortIcon;
