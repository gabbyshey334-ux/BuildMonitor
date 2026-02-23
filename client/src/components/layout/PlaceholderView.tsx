"use client";

import React from "react";

interface PlaceholderViewProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderView({ title, subtitle = "This page is being built." }: PlaceholderViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
        {title} — Coming Soon
      </h1>
      <p className="text-zinc-400 max-w-md">{subtitle}</p>
    </div>
  );
}
