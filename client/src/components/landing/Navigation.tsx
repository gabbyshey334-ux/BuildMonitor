import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, TrendingUp, Globe } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Resources", href: "#features" },
    { name: "Team", href: "#team" },
    { name: "Blog", href: "#" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? "bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 py-2" : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fresh-fern to-ocean-pine flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-bold text-white">JengaTrack</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="text-zinc-300 hover:text-white transition-colors">
                {link.name}
              </a>
            ))}
            <div className="flex items-center gap-3">
              <button className="p-2 text-zinc-400 hover:text-white transition-colors" aria-label="Language">
                <Globe className="w-5 h-5" />
              </button>
              <ThemeToggle />
              <Link href="/login">
                <Button className="bg-gradient-to-r from-fresh-fern to-ocean-pine hover:opacity-90 text-white px-6 border-0">
                  Login/Track
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-foreground/80 p-2"
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
      {isMobileMenuOpen && (
        <div className="md:hidden bg-zinc-900 border-t border-zinc-800 py-4 px-4 space-y-4">
          {navLinks.map((link) => (
            <a key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="block text-zinc-300 hover:text-white py-2">
              {link.name}
            </a>
          ))}
          <Link href="/login">
            <Button className="w-full bg-gradient-to-r from-fresh-fern to-ocean-pine text-white">Login/Track</Button>
          </Link>
        </div>
      )}
    </nav>
  );
}

