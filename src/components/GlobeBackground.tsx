import React from 'react';

export const GlobeBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
      {/* Corner registration marks matching technical blueprint aesthetic */}
      <div className="absolute top-8 left-8 w-4 h-4 border-t-2 border-l-2 border-neutral-300 opacity-60" />
      <div className="absolute top-8 right-8 w-4 h-4 border-t-2 border-r-2 border-neutral-300 opacity-60" />
      <div className="absolute bottom-8 left-8 w-4 h-4 border-b-2 border-l-2 border-neutral-300 opacity-60" />
      <div className="absolute bottom-8 right-8 w-4 h-4 border-b-2 border-r-2 border-neutral-300 opacity-60" />

      {/* Center Wireframe Globe */}
      <svg
        className="w-[850px] h-[850px] max-w-none opacity-[0.22] text-neutral-500 transform -translate-y-12"
        viewBox="0 0 800 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer boundary sphere */}
        <circle cx="400" cy="400" r="360" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx="400" cy="400" r="320" stroke="currentColor" strokeWidth="1" />

        {/* Latitudes */}
        <ellipse cx="400" cy="400" rx="360" ry="80" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="400" cy="400" rx="360" ry="180" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="400" cy="400" rx="360" ry="280" stroke="currentColor" strokeWidth="1" />
        <line x1="40" y1="400" x2="760" y2="400" stroke="currentColor" strokeWidth="1.2" />

        {/* Longitudes */}
        <ellipse cx="400" cy="400" rx="80" ry="360" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="400" cy="400" rx="180" ry="360" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="400" cy="400" rx="280" ry="360" stroke="currentColor" strokeWidth="1" />
        <line x1="400" y1="40" x2="400" y2="760" stroke="currentColor" strokeWidth="1.2" />

        {/* Diagonal orbital rings */}
        <ellipse
          cx="400"
          cy="400"
          rx="360"
          ry="150"
          transform="rotate(25 400 400)"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <ellipse
          cx="400"
          cy="400"
          rx="360"
          ry="150"
          transform="rotate(-25 400 400)"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
};
