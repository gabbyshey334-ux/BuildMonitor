import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle, CheckCircle2 } from "lucide-react";
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

      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");
      const data = isJson ? await res.json() : { message: "Something went wrong. Please try again." };

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to send reset link");
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
      <div className="min-h-screen bg-[#0a0c12] flex flex-col md:flex-row overflow-hidden">
        {/* Visual Panel - LEFT SIDE */}
        <div className="hidden md:flex w-1/2 bg-[#0a0c12] relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-white rounded-full animate-float-slow" />
            <div className="absolute top-3/4 right-1/4 w-24 h-24 border-2 border-white rotate-45 animate-float-slower" />
          </div>
          <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00bcd4] rounded-full blur-[150px] opacity-[0.15] pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <span className="text-3xl">🧱</span>
              <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
            </div>
            <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
              Secure your <br />
              <span className="text-[#00bcd4]">access.</span>
            </h1>
          </div>
        </div>

        {/* Form Panel - RIGHT SIDE */}
        <div className="w-full md:w-1/2 bg-[#0f1219] flex flex-col justify-center px-6 md:px-20 lg:px-32 relative">
          <div className="max-w-md w-full mx-auto md:mx-0 text-center">
            <div className="w-20 h-20 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mx-auto mb-6 ring-1 ring-[#00bcd4]/20">
              <CheckCircle2 className="w-10 h-10 text-[#00bcd4]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Check your email</h2>
            <p className="text-zinc-400 mb-8">
              We've sent a password reset link to <span className="text-white font-medium">{email}</span>. 
              Please click the link in the email to reset your password.
            </p>
            <Link href="/login">
              <Button className="w-full bg-[#00bcd4] hover:bg-[#0097a7] text-black font-bold h-[52px] rounded-xl text-base">
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] flex flex-col md:flex-row overflow-hidden">
      {/* Visual Panel - LEFT SIDE */}
      <div className="hidden md:flex w-1/2 bg-[#0a0c12] relative overflow-hidden flex-col justify-between p-12 border-r border-white/5">
        {/* Animated Background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-white rounded-full animate-float-slow" />
          <div className="absolute top-3/4 right-1/4 w-24 h-24 border-2 border-white rotate-45 animate-float-slower" />
          <div className="absolute bottom-10 left-10 w-40 h-40 border border-dashed border-white rounded-full animate-spin-slow" />
        </div>
        
        {/* Glow */}
        <div className="absolute top-1/2 right-1/2 translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00bcd4] rounded-full blur-[150px] opacity-[0.15] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <span className="text-3xl">🧱</span>
            <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          </div>
          
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Secure your <br />
            <span className="text-[#00bcd4]">access.</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-12 max-w-md">
            Reset your password to regain access to your construction dashboard.
          </p>

          <ul className="space-y-4">
            {[
              "Secure password reset process",
              "Instant email delivery",
              "24/7 account support"
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
      </div>

      {/* Form Panel - RIGHT SIDE */}
      <div className="w-full md:w-1/2 bg-[#0f1219] flex flex-col justify-center px-6 md:px-20 lg:px-32 relative">
        {/* Mobile Header */}
        <div className="md:hidden text-center mb-8 pt-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-3xl">🧱</span>
            <span className="text-xl font-bold text-white">JengaTrack</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Password Reset</h2>
        </div>

        <div className="max-w-md w-full mx-auto md:mx-0 animate-in slide-in-from-right duration-500 fade-in">
          {/* Desktop Logo within form (small) */}
          <div className="hidden md:flex items-center gap-2 mb-8 opacity-50">
            <span className="text-xl">🧱</span>
            <span className="font-bold text-white">JengaTrack</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Reset your password</h2>
          <p className="text-zinc-400 mb-8">Enter your email and we'll send you a reset link</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-500 text-xs uppercase font-semibold tracking-wider">Email Address</Label>
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

            <Button
              type="submit"
              className="w-full bg-[#00bcd4] hover:bg-[#0097a7] text-black font-bold h-[52px] rounded-xl text-base shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>Sending...</span>
                </div>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          <div className="text-center mt-8">
            <Link href="/login">
              <span className="text-[#00bcd4] hover:text-[#0097a7] text-sm font-bold cursor-pointer transition-colors inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
