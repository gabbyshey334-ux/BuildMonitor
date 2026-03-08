import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { LogIn, UserPlus, Lock, Mail, Eye, EyeOff, BrickWall, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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
    <div className="min-h-screen bg-[#0a0c12] flex flex-col md:flex-row overflow-hidden">
      {/* Visual Panel - RIGHT SIDE for Login */}
      <div className="hidden md:flex w-1/2 bg-[#0a0c12] relative overflow-hidden flex-col justify-between p-12 order-2 border-l border-white/5">
        {/* Animated Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-white rounded-full animate-float-slow" />
          <div className="absolute top-3/4 right-1/4 w-24 h-24 border-2 border-white rotate-45 animate-float-slower" />
          <div className="absolute bottom-10 left-10 w-40 h-40 border border-dashed border-white rounded-full animate-spin-slow" />
        </div>
        
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00bcd4] rounded-full blur-[150px] opacity-[0.15] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <span className="text-3xl">🧱</span>
            <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Build smarter. <br />
            <span className="text-[#00bcd4]">Track everything.</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-12 max-w-md">
            WhatsApp-powered construction management for African builders.
          </p>

          <ul className="space-y-4 mb-16">
            {[
              "Log expenses by WhatsApp message",
              "Real-time budget tracking",
              "Voice notes & receipt scanning",
              "Works in English and Luganda"
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-zinc-300">
                <div className="w-6 h-6 rounded-full bg-[#00bcd4]/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-[#00bcd4]" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 bg-[#0f1219]/80 backdrop-blur-md p-6 rounded-2xl border border-white/5 max-w-md">
          <p className="text-zinc-300 italic mb-4">"JengaTrack saved us 3 hours a day on site reporting. It's exactly what we needed."</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00bcd4] to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              KM
            </div>
            <div>
              <p className="text-white font-bold text-sm">Kasozi M.</p>
              <p className="text-[#00bcd4] text-xs">Site Foreman</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel - LEFT SIDE for Login */}
      <div className="w-full md:w-1/2 bg-[#0f1219] flex flex-col justify-center px-6 md:px-20 lg:px-32 relative order-1">
        {/* Mobile Header */}
        <div className="md:hidden text-center mb-8 pt-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl">🧱</span>
            <span className="text-xl font-bold text-white">JengaTrack</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Build Smarter</h2>
          <p className="text-zinc-400 text-sm">WhatsApp-powered construction management</p>
        </div>

        <div className="max-w-md w-full mx-auto md:mx-0 animate-in slide-in-from-left duration-500 fade-in">
          {/* Desktop Logo within form (small) */}
          <div className="hidden md:flex items-center gap-2 mb-8 opacity-50">
            <span className="text-xl">🧱</span>
            <span className="font-bold text-white">JengaTrack</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
          <p className="text-zinc-400 mb-8">Sign in to your dashboard</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-500 text-xs uppercase font-semibold tracking-wider">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-[#00bcd4] transition-colors" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="bg-[#161b27] border-white/10 text-white placeholder:text-zinc-600 pl-12 h-12 rounded-xl focus:border-[#00bcd4] focus:ring-0 focus:ring-offset-0 transition-all"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-500 text-xs uppercase font-semibold tracking-wider">Password</Label>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-[#00bcd4] transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-[#161b27] border-white/10 text-white placeholder:text-zinc-600 pl-12 pr-12 h-12 rounded-xl focus:border-[#00bcd4] focus:ring-0 focus:ring-offset-0 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <Link href="/forgot-password">
                  <span className="text-xs text-[#00bcd4] hover:text-[#0097a7] cursor-pointer font-medium transition-colors">
                    Forgot password?
                  </span>
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#00bcd4] hover:bg-[#0097a7] text-black font-bold h-[52px] rounded-xl text-base shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center mt-8 text-zinc-400 text-sm">
            Don't have an account?{" "}
            <Link href="/signup">
              <span className="text-[#00bcd4] hover:text-[#0097a7] font-bold cursor-pointer transition-colors">
                Sign up
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
