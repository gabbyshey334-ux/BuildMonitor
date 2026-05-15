import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { cn } from "@/lib/utils";

export default function Navigation() {
  const { t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { nameKey: "landing.nav.features", href: "#features", hasDropdown: true },
    { nameKey: "landing.nav.pricing", href: "#pricing" },
    { nameKey: "landing.nav.blog", href: "#blog" },
    { nameKey: "landing.nav.contact", href: "#contact" },
  ];

  const navSolid = isScrolled || isMobileMenuOpen;

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        navSolid
          ? isDark
            ? "bg-[#0a0a0a]/98 border-b border-zinc-800/60 backdrop-blur-md py-3"
            : "bg-white/98 border-b border-slate-200 backdrop-blur-md py-3"
          : "bg-transparent py-4",
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/assets/images/logo.png"
              alt="JengaTrack"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain mix-blend-multiply dark:mix-blend-lighten group-hover:drop-shadow-[0_0_12px_rgba(34,197,94,0.5)] transition-shadow duration-300"
            />
            <span className="text-xl font-bold dark:text-white text-slate-800 tracking-tight">JengaTrack</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <a 
                key={link.nameKey} 
                href={link.href} 
                className="relative px-4 py-2 text-sm font-medium dark:text-zinc-300 dark:hover:text-white text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <span className="flex items-center gap-1">
                  {t(link.nameKey)}
                  {link.hasDropdown && (
                    <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  )}
                </span>
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#22c55e] to-[#14b8a6] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </a>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageSwitcher variant="compact" />
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 dark:text-zinc-400 dark:hover:text-white text-slate-600 hover:text-slate-800 transition-colors rounded-lg dark:hover:bg-zinc-800/50 hover:bg-slate-200 duration-200"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            {/* CTA Button */}
            <Link href="/login">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 border-0 ml-2"
              >
                {t("landing.nav.loginSignUp")}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isDark ? "text-zinc-300 hover:text-white hover:bg-zinc-800/50" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
              )}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isDark ? "text-zinc-100 hover:text-white hover:bg-zinc-800/50" : "text-slate-700 hover:text-slate-900 hover:bg-slate-100",
              )}
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden absolute top-full left-0 right-0 border-b overflow-hidden transition-all duration-300",
          isDark ? "bg-[#0a0a0a] border-zinc-800/60" : "bg-white border-slate-200",
          isMobileMenuOpen ? "max-h-[min(85vh,520px)] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
        )}
      >
        <div className="px-4 py-3 space-y-0.5">
          {navLinks.map((link) => (
            <a
              key={link.nameKey}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium transition-colors",
                isDark
                  ? "text-zinc-100 hover:text-white hover:bg-zinc-800/60"
                  : "text-slate-900 hover:text-slate-950 hover:bg-slate-100",
              )}
            >
              <span>{t(link.nameKey)}</span>
              {link.hasDropdown && (
                <ChevronDown
                  className={cn("w-4 h-4 shrink-0", isDark ? "text-zinc-400" : "text-slate-500")}
                />
              )}
            </a>
          ))}

          <div
            className={cn(
              "pt-3 mt-2 border-t space-y-3",
              isDark ? "border-zinc-800/60" : "border-slate-200",
            )}
          >
            <LanguageSwitcher variant="compact" />
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block">
              <Button className="w-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white py-3 rounded-lg font-semibold border-0">
                {t("landing.nav.loginSignUp")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}