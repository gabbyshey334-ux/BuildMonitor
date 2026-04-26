import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { ArrowLeft, Mail, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Extracted API call so it can be reused by the resend action
  const sendResetLink = async (emailAddress: string) => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddress, redirectTo }),
    });

    const contentType = res.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");
    const data = isJson ? await res.json() : { message: "Something went wrong. Please try again." };

    if (!res.ok) {
      throw new Error(data.message || data.error || "Failed to send reset link");
    }
  };

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
      await sendResetLink(trimmedEmail);
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

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await sendResetLink(email.trim());
      toast({
        title: "Link Resent",
        description: "A new reset link has been sent to your email.",
      });
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setSuccess(false);
    } finally {
      setIsLoading(false);
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
        <GridPattern id="grid-forgot-d" />
      </div>

      {/* ── Mobile only: Zone A — Brand Panel (fixed, top 38vh) ── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-[38vh] z-[2] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1A14]/50 via-[#0F1A14]/70 to-[#0F1A14]/90" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <GridPattern id="grid-forgot-m" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/50 shadow-[0_0_20px_rgba(30,122,62,0.25)] flex items-center justify-center overflow-hidden bg-white/5">
            <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          <p className="text-sm text-[#F59E0B]">We'll get you back in.</p>
        </div>
      </div>

      {/* ── Zone B — Form card ── */}
      <div className="relative z-[3] mt-[calc(38vh-20px)] md:mt-0 md:flex md:items-center md:justify-center md:min-h-screen md:px-6">
        <div className="bg-white w-full rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:rounded-2xl md:shadow-2xl md:max-w-md px-6 pt-8 pb-10 md:p-10 min-h-[calc(65vh+20px)] md:min-h-0">

          {/* Desktop-only logo header */}
          <div className="hidden md:flex flex-col items-center mb-8 gap-2">
            <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/40 shadow-sm flex items-center justify-center overflow-hidden">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#0F1A14]">JengaTrack</span>
          </div>

          {success ? (
            /* ── Success panel ── */
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-[#1E7A3E]/10 border border-[#1E7A3E]/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-[#1E7A3E]" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Check your inbox</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  We sent a reset link to{" "}
                  <span className="font-medium text-[#0F1A14]">{email}</span>.{" "}
                  It expires in 15 minutes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-[#1E7A3E] transition-colors disabled:opacity-60 flex items-center gap-1"
              >
                {isLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Resending…</>
                ) : (
                  "Didn't receive it? Resend"
                )}
              </button>

              <Link href="/login">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1E7A3E] transition-colors cursor-pointer mt-1">
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </span>
              </Link>
            </div>

          ) : (
            /* ── Form panel ── */
            <>
              {/* Back link */}
              <Link href="/login">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1E7A3E] transition-colors cursor-pointer mb-6">
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </span>
              </Link>

              {/* Heading */}
              <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Reset your password</h2>
              <p className="text-sm text-gray-500 mt-1">
                Enter your email and we'll send a reset link
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
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
                      className={`h-[52px] pl-10 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${error ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-[#DC2626] mt-1">{error}</p>
                  )}
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
                      Sending…
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
