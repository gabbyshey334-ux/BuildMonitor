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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6 shadow-lg">
            <span className="text-2xl font-black text-primary-foreground">CM</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-muted-foreground text-sm">
            Log in to manage your construction projects
          </p>
        </div>

        <Card className="bg-card border-border backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-card-foreground">
              Account Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80 text-xs uppercase tracking-wider font-bold">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground pl-10 h-12 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground/80 text-xs uppercase tracking-wider font-bold">Password</Label>
                  <Link href="/forgot-password">
                    <span className="text-xs text-primary hover:text-primary/80 transition-colors font-medium cursor-pointer">
                      Forgot password?
                    </span>
                  </Link>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground pl-10 pr-10 h-12 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl shadow-lg transition-all active:scale-[0.98]"
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
          <CardFooter className="bg-secondary/30 border-t border-border py-4 flex justify-center">
            <p className="text-muted-foreground text-sm">
              Don't have an account?{" "}
              <Link href="/signup">
                <span className="text-primary hover:text-primary/80 font-bold transition-colors cursor-pointer inline-flex items-center gap-1">
                  Create one <UserPlus className="h-3 w-3" />
                </span>
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-center mt-8 text-muted-foreground text-xs uppercase tracking-widest font-bold">
          &copy; 2026 BuildMonitor Uganda
        </p>
      </div>
    </div>
  );
}
