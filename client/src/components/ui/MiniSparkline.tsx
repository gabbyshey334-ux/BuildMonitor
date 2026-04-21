"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Inline ultra-compact sparkline. Uses raw SVG (not Recharts) for speed
 * and to render inline inside table cells.
 */
export interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
  showDots?: boolean;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color = "#93C54E",
  fillColor,
  strokeWidth = 1.5,
  className,
  showDots = false,
}: MiniSparklineProps) {
  const values = data.filter((v) => Number.isFinite(v));
  if (values.length < 2) {
    return (
      <div
        aria-hidden
        className={cn("rounded bg-muted/40 h-1 w-full", className)}
        style={{ width, height: height * 0.4 }}
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return { x, y };
  });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = fillColor
    ? `${d} L ${width} ${height} L 0 ${height} Z`
    : null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      {areaD && fillColor && (
        <path d={areaD} fill={fillColor} opacity="0.8" />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots &&
        points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={color} />
        ))}
    </svg>
  );
}

export default MiniSparkline;
