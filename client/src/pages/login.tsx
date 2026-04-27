import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Inline SVG grid — graph-paper texture at 4% opacity
function GridPattern({ id }: { id: string }) {
  return (
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0"
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export default function Login() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">

      {/* ── Full-page background image ── */}
      <img
        src="https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=1200&auto=format&fit=crop&q=80"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* ── Desktop: dark overlay + SVG grid on top of image ── */}
      <div className="hidden md:block absolute inset-0 bg-[#0F1A14]/80 z-[1]" />
      <div className="hidden md:block absolute inset-0 opacity-[0.04] pointer-events-none overflow-hidden z-[1]">
        <GridPattern id="grid-login-d" />
      </div>

      {/* ── Mobile only: Zone A — Brand Panel (fixed, top 38vh) ── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-[38vh] z-[2] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1A14]/50 via-[#0F1A14]/70 to-[#0F1A14]/90" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <GridPattern id="grid-login-m" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/50 shadow-[0_0_20px_rgba(30,122,62,0.25)] flex items-center justify-center overflow-hidden bg-white/5">
            <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          <p className="text-sm text-[#F59E0B]">Your site. Your numbers. In control.</p>
        </div>
      </div>

      {/* ── Zone B — Form card ── */}
      {/*   Mobile: pushed below Zone A with 20px overlap                              */}
      {/*   Desktop: centered card on dark background                                  */}
      <div className="relative z-[3] mt-[calc(38vh-20px)] md:mt-0 md:flex md:items-center md:justify-center md:min-h-screen md:px-6">
        <div className="bg-white w-full rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:rounded-2xl md:shadow-2xl md:max-w-md px-6 pt-8 pb-10 md:p-10 min-h-[calc(65vh+20px)] md:min-h-0">

          {/* Desktop-only logo header */}
          <div className="hidden md:flex flex-col items-center mb-8 gap-2">
            <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/40 shadow-sm flex items-center justify-center overflow-hidden">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#0F1A14]">JengaTrack</span>
          </div>

          {/* Form heading */}
          <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">{t("auth.login.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("auth.login.subtitle")}</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                {t("auth.login.email")}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="h-[52px] pl-10 bg-[#F8FAF9] border-[#E5E7EB] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  {t("auth.login.password")}
                </Label>
                <Link href="/forgot-password">
                  <span className="text-xs text-[#1E7A3E] cursor-pointer hover:underline underline-offset-2 font-medium">
                    {t("auth.login.forgot")}
                  </span>
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-[52px] pl-10 pr-12 bg-[#F8FAF9] border-[#E5E7EB] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 min-h-[44px] flex items-center"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* CTA */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] bg-[#1E7A3E] hover:bg-green-800 active:bg-green-900 text-white font-semibold text-base rounded-xl transition-colors mt-6 disabled:opacity-70"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("auth.login.signingIn")}
                </span>
              ) : (
                t("auth.login.button")
              )}
            </Button>
          </form>

          {/* Bottom link */}
          <p className="text-sm text-gray-500 text-center mt-4">
            {t("auth.login.noaccount")}{" "}
            <Link href="/signup">
              <span className="text-[#1E7A3E] font-medium cursor-pointer hover:underline underline-offset-2">
                {t("auth.login.signupLink")}
              </span>
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
