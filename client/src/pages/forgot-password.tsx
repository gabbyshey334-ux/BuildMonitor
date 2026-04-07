import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, redirectTo }),
      });

      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");
      const data = isJson ? await res.json() : { message: "Something went wrong. Please try again." };

      if (!res.ok) {
        const message = data.message || data.error || "Failed to send reset link";
        setError(message);
        return;
      }

      setSuccess(true);
      toast({
        title: "Link Sent",
        description: "Check your email for the reset password link.",
      });
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* LEFT COLUMN - Image Side */}
      <div className="relative w-full md:w-[45%] h-[260px] md:h-screen md:fixed md:top-0 md:left-0 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=1200&auto=format&fit=crop&q=80&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGNvbnN0cnVjdGlvbiUyMHNpdGV8ZW58MHx8MHx8fDA%3D" 
          alt="Construction site" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#218598]/40 via-[#2F3332]/60 to-[#2F3332]/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/20" />
        
        {/* Bottom Content */}
        <div className="absolute bottom-10 left-10 right-10 text-white z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl overflow-hidden shrink-0">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-8 h-8 object-contain drop-shadow-md" />
            </div>
            <span className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">JengaTrack</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
            Build smarter.<br />Track everything.
          </h1>
          <p className="text-white/80 text-base md:text-lg mb-8 font-light max-w-md">
            The ultimate WhatsApp-powered construction management platform for modern builders.
          </p>

          <div className="flex flex-wrap gap-3">
            {["500+ projects tracked", "Real-time updates", "Works on WhatsApp"].map((tag, i) => (
              <span key={i} className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-sm font-medium border border-white/20 shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Form Side */}
      <div className="w-full md:w-[55%] md:ml-[45%] min-h-screen bg-background relative flex flex-col justify-center items-center py-12 px-6 md:px-10 overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#218598]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#93C54E]/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          
          {success ? (
            // Success State
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl text-center space-y-6">
               <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#93C54E]/20 to-[#218598]/20 flex items-center justify-center mx-auto border border-[#218598]/20 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-[#218598]" />
              </div>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Check your email</h2>
              <p className="text-muted-foreground text-lg">
                We've sent a password reset link to <br /><span className="text-foreground font-semibold">{email}</span>.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Please click the link in the email to reset your password.
              </p>
              <Button asChild className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg mt-6">
                <Link href="/login">Back to Sign In</Link>
              </Button>
            </div>
          ) : (
            // Form State
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
              {/* Header */}
              <div className="space-y-3 mb-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#93C54E]/20 to-[#218598]/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 mx-auto mb-4 border border-[#218598]/20 shadow-inner">
                  <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain drop-shadow-sm" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Reset password</h2>
                <p className="text-muted-foreground">Enter your email to receive a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-semibold ml-1">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="name@example.com"
                    required
                    className="bg-background/50 border-border/60 rounded-xl h-14 px-4 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                  />
                  {error && <p className="text-red-500 text-sm mt-1 ml-1">{error}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg mt-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <Link href="/login">
                  <span className="text-muted-foreground hover:text-foreground text-sm font-medium cursor-pointer transition-colors inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to sign in
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
