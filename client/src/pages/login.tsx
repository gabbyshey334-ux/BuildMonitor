import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* LEFT COLUMN - Image Side */}
      <div className="relative w-full md:w-[45%] h-[260px] md:h-screen md:fixed md:top-0 md:left-0 bg-[#1a2e1a] overflow-hidden">
        <img 
          src="/construction-site.jpg" 
          alt="Construction site" 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        
        {/* Bottom Content */}
        <div className="absolute bottom-10 left-10 right-10 text-white z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-cyan-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-cyan-500/30">
              <span className="text-xl">🧱</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">JengaTrack</span>
          </div>
          
          <h1 className="text-[28px] font-bold leading-tight mb-2">
            Build smarter. Track everything.
          </h1>
          <p className="text-white/70 text-sm mb-6">
            WhatsApp-powered construction management
          </p>

          <div className="flex flex-wrap gap-2">
            {["500+ projects tracked", "Real-time updates", "Works on WhatsApp"].map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-medium border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Form Side */}
      <div className="w-full md:w-[55%] md:ml-[45%] min-h-screen bg-background flex flex-col justify-center items-center py-12 px-6 md:px-10">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Logo & Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <span className="text-lg">🧱</span>
              </div>
              <span className="font-bold text-foreground">JengaTrack</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-muted-foreground text-sm">Sign in to your dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="bg-muted border-border rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-muted border-border rounded-xl h-12 pl-4 pr-12 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <Link href="/forgot-password">
                  <span className="text-xs text-cyan-500 hover:text-cyan-600 cursor-pointer font-medium transition-colors">
                    Forgot password?
                  </span>
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-sm">
            Don't have an account?{" "}
            <Link href="/signup">
              <span className="text-cyan-500 hover:text-cyan-600 font-medium cursor-pointer transition-colors">
                Sign up
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
