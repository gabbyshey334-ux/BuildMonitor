import { Link } from "wouter";
import { Facebook, Linkedin, Instagram, Youtube, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="dark:bg-[#0a0a0a] bg-slate-100 border-t dark:border-zinc-800/50 border-slate-200">
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
              <span className="text-xl font-bold dark:text-white text-slate-900">JengaTrack</span>
            </Link>
            
            <p className="dark:text-zinc-500 text-slate-500 text-sm">{t("landing.footer.tagline")}</p>

            {/* Social Icons */}
            <div className="flex gap-4">
              <a href="#" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors" aria-label="YouTube">
                <Youtube className="w-5 h-5" />
              </a>
              <a href="mailto:info@jengatrack.com" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors" aria-label="Email">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Center - Navigation Links (CENTERED) */}
          <div className="flex items-center justify-center gap-8 lg:gap-12 lg:w-2/4 lg:justify-center">
            <a href="#about" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors text-sm">{t("landing.footer.about")}</a>
            <a href="#features" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors text-sm">{t("landing.nav.features")}</a>
            <a href="#pricing" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors text-sm">{t("landing.nav.pricing")}</a>
            <a href="#waitlist" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors text-sm">{t("landing.footer.waitlist")}</a>
            <a href="#blog" className="dark:text-zinc-400 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors text-sm">{t("landing.nav.blog")}</a>
          </div>

          {/* Right Side - Contact Info */}
          <div className="space-y-4 lg:w-1/4 lg:border-l dark:lg:border-zinc-800 lg:border-slate-200 lg:pl-8">
            <div>
              <p className="dark:text-zinc-500 text-slate-500 text-xs uppercase tracking-wider mb-1">{t("landing.footer.location")}</p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">10 Lumumba Av, Nairobi, Kenya</p>
            </div>
            <div>
              <p className="dark:text-zinc-500 text-slate-500 text-xs uppercase tracking-wider mb-1">{t("landing.footer.email")}</p>
              <p className="dark:text-zinc-400 text-slate-600 text-sm">info@jengatrack.com</p>
            </div>
            <a href="#contact">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white border-0 rounded-lg px-6 mt-2"
              >
                {t("landing.footer.contact")}
              </Button>
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t dark:border-zinc-800/50 border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex gap-6 text-sm">
            <a href="/privacy" className="dark:text-zinc-500 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors">{t("landing.footer.privacyPolicy")}</a>
            <span className="dark:text-zinc-700 text-slate-300">|</span>
            <a href="/terms" className="dark:text-zinc-500 dark:hover:text-white text-slate-500 hover:text-slate-800 transition-colors">{t("landing.footer.termsConditions")}</a>
          </div>
          <p className="text-sm dark:text-zinc-500 text-slate-500">© {currentYear} JengaTrack. {t("landing.footer.allRightsReserved")}</p>
        </div>
      </div>
    </footer>
  );
}