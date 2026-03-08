import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
          
          {isSubmitted ? (
            // Success State
            <div className="text-center space-y-6">
               <div className="w-20 h-20 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto ring-1 ring-cyan-500/20">
                <CheckCircle2 className="w-10 h-10 text-cyan-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Check your email</h2>
              <p className="text-muted-foreground">
                We've sent a password reset link to <span className="text-foreground font-medium">{email}</span>. 
                Please click the link in the email to reset your password.
              </p>
              <Link href="/login">
                <Button className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors text-base mt-4">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            // Form State
            <>
              {/* Logo & Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-lg">🧱</span>
                  </div>
                  <span className="font-bold text-foreground">JengaTrack</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Reset your password</h2>
                <p className="text-muted-foreground text-sm">Enter your email and we'll send you a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
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

                <Button
                  type="submit"
                  className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors text-base"
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

              <div className="text-center">
                <Link href="/login">
                  <span className="text-cyan-500 hover:text-cyan-600 text-sm font-medium cursor-pointer transition-colors inline-flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to sign in
                  </span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
