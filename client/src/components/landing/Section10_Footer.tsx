import { Link } from "wouter";
import { Facebook, Linkedin, Instagram, Youtube, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0a0a] border-t border-zinc-800/50">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
          {/* Left Side - Logo & Social */}
          <div className="space-y-6 lg:w-1/4">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/assets/images/logo.png"
                alt="JengaTrack"
                className="w-8 h-8 object-contain mix-blend-multiply dark:mix-blend-lighten"
              />
              <span className="text-xl font-bold text-white">JengaTrack</span>
            </Link>
            
            <p className="text-zinc-500 text-sm">Build With Clarity</p>

            {/* Social Icons */}
            <div className="flex gap-4">
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors" aria-label="YouTube">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="mailto:info@jengatrack.com" className="text-zinc-400 hover:text-white transition-colors" aria-label="Email">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Center - Navigation Links (CENTERED) */}
          <div className="flex items-center justify-center gap-8 lg:gap-12 lg:w-2/4 lg:justify-center">
            <a href="#about" className="text-zinc-400 hover:text-white transition-colors text-sm">About</a>
            <a href="#features" className="text-zinc-400 hover:text-white transition-colors text-sm">Features</a>
            <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors text-sm">Pricing</a>
            <a href="#waitlist" className="text-zinc-400 hover:text-white transition-colors text-sm">Waitlist</a>
            <a href="#blog" className="text-zinc-400 hover:text-white transition-colors text-sm">Blog</a>
          </div>

          {/* Right Side - Contact Info */}
          <div className="space-y-4 lg:w-1/4 lg:border-l lg:border-zinc-800 lg:pl-8">
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Location:</p>
              <p className="text-zinc-400 text-sm">10 Lumumba Av, Nairobi, Kenya</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Email:</p>
              <p className="text-zinc-400 text-sm">info@jengatrack.com</p>
            </div>
            <a href="#contact">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white border-0 rounded-lg px-6 mt-2"
              >
                Contact
              </Button>
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-6 text-sm">
            <a href="/privacy" className="text-zinc-500 hover:text-white transition-colors">Privacy Policy</a>
            <span className="text-zinc-700">|</span>
            <a href="/terms" className="text-zinc-500 hover:text-white transition-colors">Terms & Conditions</a>
          </div>
          <p className="text-sm text-zinc-500">© {currentYear} JengaTrack. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}