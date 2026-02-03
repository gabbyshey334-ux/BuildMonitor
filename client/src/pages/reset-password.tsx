import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      setIsSuccess(true);
      toast({
        title: "Success",
        description: "Your password has been reset successfully.",
      });
      
      // Redirect to login after 3 seconds
      setTimeout(() => setLocation("/login"), 3000);
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[440px] px-6 relative z-10">
          <Card className="bg-[#121624]/80 border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl text-center py-8">
            <CardContent className="space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-white">Password Reset!</h1>
              <p className="text-slate-400">
                Your password has been successfully updated. You will be redirected to the login page in a few seconds.
              </p>
              <Link href="/login">
                <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-12 rounded-xl mt-4">
                  Go to Login Now
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c14] relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 mb-6 shadow-lg shadow-amber-500/20">
            <span className="text-2xl font-black text-white">CM</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Set New Password
          </h1>
          <p className="text-slate-400 text-sm">
            Please enter your new password below
          </p>
        </div>

        <Card className="bg-[#121624]/80 border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleReset} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 text-xs uppercase tracking-wider font-bold">New Password</Label>
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300 text-xs uppercase tracking-wider font-bold">Confirm Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-[#0a0c14]/50 border-white/5 text-white placeholder:text-slate-600 pl-10 pr-10 h-12 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                  />
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
                    <span>Updating...</span>
                  </div>
                ) : (
                  <span>Update Password</span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-white/[0.02] border-t border-white/5 py-4 flex justify-center">
            <Link href="/login">
              <span className="text-slate-400 hover:text-white transition-colors text-sm font-medium cursor-pointer">
                Cancel and go to Login
              </span>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}


