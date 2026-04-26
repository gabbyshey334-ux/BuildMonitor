import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Lock, CheckCircle, XCircle, ArrowLeft, Loader2 } from "lucide-react";
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

function parseHashParams(): { access_token?: string; refresh_token?: string; type?: string } {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash?.replace(/^#/, "") || "";
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

// 0-4 segment strength score mapped from password heuristics
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let raw = 0;
  if (pw.length >= 8) raw++;
  if (pw.length >= 12) raw++;
  if (/[A-Z]/.test(pw)) raw++;
  if (/[0-9]/.test(pw)) raw++;
  if (/[^A-Za-z0-9]/.test(pw)) raw++;
  if (raw <= 1) return { score: 1, label: "Weak", color: "#DC2626" };
  if (raw <= 2) return { score: 2, label: "Fair", color: "#F59E0B" };
  if (raw <= 3) return { score: 3, label: "Good", color: "#EAB308" };
  return { score: 4, label: "Strong", color: "#1E7A3E" };
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    const { access_token, type } = parseHashParams();
    if (type === "recovery" && access_token) {
      setRecoveryToken(access_token);
      setError(null);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      setError("Invalid or expired reset link. Please request a new one.");
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!recoveryToken) {
      setError("Please use the link from your password reset email to continue.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, token: recoveryToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to reset password");

      setIsSuccess(true);
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      setTimeout(() => setLocation("/login"), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
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
        <GridPattern id="grid-reset-d" />
      </div>

      {/* ── Mobile only: Zone A — Brand Panel (fixed, top 38vh) ── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-[38vh] z-[2] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1A14]/50 via-[#0F1A14]/70 to-[#0F1A14]/90" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <GridPattern id="grid-reset-m" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/50 shadow-[0_0_20px_rgba(30,122,62,0.25)] flex items-center justify-center overflow-hidden bg-white/5">
            <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          <p className="text-sm text-[#F59E0B]">Choose a strong new password.</p>
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

          {/* ── Success panel ── */}
          {isSuccess ? (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-[#1E7A3E]/10 border border-[#1E7A3E]/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-[#1E7A3E]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Password updated!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  You can now sign in with your new password.
                </p>
              </div>
              <Button
                asChild
                className="w-full h-[52px] bg-[#1E7A3E] hover:bg-green-800 text-white font-semibold text-base rounded-xl transition-colors"
              >
                <Link href="/login">Go to Login</Link>
              </Button>
            </div>

          ) : !recoveryToken ? (
            /* ── Token error / missing panel ── */
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-[#DC2626]" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Link expired or invalid</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Reset links expire after 15 minutes. Request a new one.
                </p>
              </div>
              <Button
                asChild
                className="w-full h-[52px] bg-[#1E7A3E] hover:bg-green-800 text-white font-semibold text-base rounded-xl transition-colors"
              >
                <Link href="/forgot-password">Request New Link</Link>
              </Button>
              <Link href="/login">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1E7A3E] transition-colors cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </span>
              </Link>
            </div>

          ) : (
            /* ── Password reset form ── */
            <>
              {/* Back link */}
              <Link href="/login">
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1E7A3E] transition-colors cursor-pointer mb-6">
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </span>
              </Link>

              {/* Heading */}
              <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Set new password</h2>
              <p className="text-sm text-gray-500 mt-1">Must be at least 8 characters</p>

              <form onSubmit={handleReset} className="mt-6 space-y-4">

                {/* Inline error banner */}
                {error && (
                  <div className="flex items-start gap-2.5 bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] text-sm p-3.5 rounded-xl">
                    <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="h-[52px] pl-10 pr-12 bg-[#F8FAF9] border-[#E5E7EB] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 min-h-[44px] flex items-center"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* 4-segment strength bar */}
                  {password.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((seg) => (
                          <div
                            key={seg}
                            className="flex-1 h-1.5 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor:
                                seg <= strength.score ? strength.color : "#E5E7EB",
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs font-medium" style={{ color: strength.color }}>
                        {strength.label}
                        {strength.label === "Weak" && " — try adding numbers or symbols"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className={`h-[52px] pl-10 pr-20 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 text-[#0F1A14] placeholder:text-gray-400 transition-all ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? "border-[#1E7A3E]/60 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E]"
                            : "border-[#DC2626]/60 focus-visible:ring-[#DC2626]/20 focus-visible:border-[#DC2626]"
                          : "border-[#E5E7EB] focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E]"
                      }`}
                    />
                    {/* Match indicator icon */}
                    {confirmPassword.length > 0 && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                        {passwordsMatch ? (
                          <CheckCircle className="h-4 w-4 text-[#1E7A3E]" />
                        ) : (
                          <XCircle className="h-4 w-4 text-[#DC2626]" />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 min-h-[44px] flex items-center"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-[#DC2626] mt-1">Passwords do not match</p>
                  )}
                </div>

                {/* CTA */}
                <Button
                  type="submit"
                  disabled={isLoading || (confirmPassword.length > 0 && !passwordsMatch)}
                  className="w-full h-[52px] bg-[#1E7A3E] hover:bg-green-800 active:bg-green-900 text-white font-semibold text-base rounded-xl transition-colors mt-6 disabled:opacity-70"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Updating password…
                    </span>
                  ) : (
                    "Update Password"
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
