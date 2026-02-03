import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send reset link");
      }

      setIsSubmitted(true);
      toast({
        title: "Link Sent",
        description: "Check your email for the reset password link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
              <h1 className="text-2xl font-bold text-white">Check your email</h1>
              <p className="text-slate-400">
                We've sent a password reset link to <span className="text-white font-medium">{email}</span>. 
                Please click the link in the email to reset your password.
              </p>
              <Link href="/login">
                <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-12 rounded-xl mt-4">
                  Back to Login
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
            Forgot Password?
          </h1>
          <p className="text-slate-400 text-sm">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        <Card className="bg-[#121624]/80 border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
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

              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-amber-900/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-white/[0.02] border-t border-white/5 py-4 flex justify-center">
            <Link href="/login">
              <span className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2 cursor-pointer">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </span>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}


