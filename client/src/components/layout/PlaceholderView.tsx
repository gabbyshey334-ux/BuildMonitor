"use client";

import React from "react";

interface PlaceholderViewProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderView({ title, subtitle = "Content will be available shortly." }: PlaceholderViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground max-w-md">{subtitle}</p>
    </div>
  );
}
