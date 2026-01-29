import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { LogIn, UserPlus, Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function Login() {
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
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 mb-6 shadow-lg shadow-amber-500/20">
            <span className="text-2xl font-black text-white">CM</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-400 text-sm">
            Log in to manage your construction projects
          </p>
        </div>

        <Card className="bg-[#121624]/80 border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-white">
              Account Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 text-xs uppercase tracking-wider font-bold">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="bg-[#0a0c14]/50 border-white/5 text-white placeholder:text-slate-600 pl-10 h-12 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300 text-xs uppercase tracking-wider font-bold">Password</Label>
                  <Link href="/forgot-password">
                    <span className="text-xs text-amber-500 hover:text-amber-400 transition-colors font-medium cursor-pointer">
                      Forgot password?
                    </span>
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-[#0a0c14]/50 border-white/5 text-white placeholder:text-slate-600 pl-10 pr-10 h-12 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-amber-900/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-white/[0.02] border-t border-white/5 py-4 flex justify-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{" "}
              <Link href="/signup">
                <span className="text-amber-500 hover:text-amber-400 font-bold transition-colors cursor-pointer inline-flex items-center gap-1">
                  Create one <UserPlus className="h-3 w-3" />
                </span>
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center mt-8 text-slate-600 text-xs uppercase tracking-widest font-bold">
          &copy; 2026 BuildMonitor Uganda
        </p>
      </div>
    </div>
  );
}
