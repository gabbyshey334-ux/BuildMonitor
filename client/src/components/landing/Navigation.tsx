import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown, Moon, Sun } from "lucide-react";

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Add your theme toggle logic here
  };

  const navLinks = [
    { name: "Features", href: "#features", hasDropdown: true },
    { name: "Pricing", href: "#pricing" },
    { name: "Blog", href: "#blog" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? "bg-[#0a0a0a]/95 backdrop-blur-md border-b border-zinc-800/50 py-3" 
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[#22c55e] to-[#14b8a6] flex items-center justify-center overflow-hidden group-hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-shadow duration-300">
              {/* JengaTrack Logo Icon - Stacked blocks style */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <rect x="4" y="16" width="16" height="4" rx="1"/>
                <rect x="6" y="10" width="12" height="4" rx="1"/>
                <rect x="8" y="4" width="8" height="4" rx="1"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">JengaTrack</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="relative px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors group"
              >
                <span className="flex items-center gap-1">
                  {link.name}
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
            {/* Language Selector */}
            <button 
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50"
              aria-label="Select Language"
            >
              <span className="text-base">🇺🇬</span>
              <span>EN</span>
              <ChevronDown className="w-4 h-4 opacity-50" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800/50"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>

            {/* CTA Button */}
            <Link href="/login">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 border-0 ml-2"
              >
                Login/SignUp
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-zinc-300 hover:text-white transition-colors"
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
        className={`md:hidden absolute top-full left-0 right-0 bg-[#0a0a0a]/98 backdrop-blur-lg border-b border-zinc-800/50 overflow-hidden transition-all duration-300 ${
          isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <a 
              key={link.name} 
              href={link.href} 
              onClick={() => setIsMobileMenuOpen(false)} 
              className="flex items-center justify-between px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
            >
              <span className="font-medium">{link.name}</span>
              {link.hasDropdown && <ChevronDown className="w-4 h-4 opacity-50" />}
            </a>
          ))}
          
          <div className="pt-4 mt-4 border-t border-zinc-800/50 space-y-3">
            {/* Mobile Language Selector */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors">
              <span className="text-lg">🇺🇬</span>
              <span>English</span>
            </button>
            
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
              <Button 
                className="w-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white py-3 rounded-lg font-semibold"
              >
                Login/SignUp
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}