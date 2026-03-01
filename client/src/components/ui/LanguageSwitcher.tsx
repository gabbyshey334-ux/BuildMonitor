"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useLanguage, type Language } from "@/contexts/LanguageContext";

const languages: Array<{ code: Language; name: string; flag: string; short: string }> = [
  { code: "en", name: "English", flag: "🇬🇧", short: "EN" },
  { code: "lg", name: "Luganda", flag: "🇺🇬", short: "LG" },
  { code: "pt", name: "Português", flag: "🇵🇹", short: "PT" },
];

export function LanguageSwitcher({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = languages.find((l) => l.code === language) ?? languages[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg dark:hover:bg-zinc-700 hover:bg-slate-100 dark:text-zinc-300 text-slate-600 text-sm font-medium transition-colors"
        aria-label="Select language"
      >
        <span className="text-base">{current.flag}</span>
        {variant === "full" && <span>{current.name}</span>}
        {variant === "compact" && <span className="text-xs">{current.short}</span>}
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 dark:bg-[#1e2235] bg-white dark:border-zinc-700 border-slate-200 border rounded-lg shadow-lg overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left ${
                  language === lang.code
                    ? "dark:bg-zinc-700 bg-slate-100 text-cyan-500 font-medium"
                    : "dark:text-zinc-300 text-slate-600 dark:hover:bg-zinc-700/50 hover:bg-slate-50"
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
                {language === lang.code && <Check size={14} className="ml-auto text-cyan-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
