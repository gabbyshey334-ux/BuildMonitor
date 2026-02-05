import React from 'react';

interface CircularProgressProps {
  value: number; // Percentage value (0-100)
  color?: string; // Color of the progress stroke
  size?: number; // Size of the SVG (width and height)
  strokeWidth?: number; // Width of the progress stroke
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  color = '#93C54E',
  size = 128,
  strokeWidth = 10,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth={strokeWidth}
      />

      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
      >
        {/* Add animation for smooth transition */}
        <animate
          attributeName="strokeDashoffset"
          from={circumference}
          to={strokeDashoffset}
          dur="1s"
          fill="freeze"
        />
      </circle>

      {/* Text in the center */}
      <text
        x="50%"
        y="50%"
        dy=".3em"
        textAnchor="middle"
        fill={color}
        fontSize={size / 4}
        fontWeight="bold"
      >
        {value}%
      </text>
    </svg>
  );
};

