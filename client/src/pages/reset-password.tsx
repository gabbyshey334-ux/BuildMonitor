import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { score, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { score, label: "Good", color: "#93C54E" };
  return { score, label: "Strong", color: "#218598" };
}

const LEFT_TAGS = ["500+ projects tracked", "Real-time updates", "Works on WhatsApp"];

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
    } else if (!access_token && !type && window.location.hash) {
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* ── LEFT COLUMN ── */}
      <div className="relative w-full md:w-[45%] h-[260px] md:h-screen md:fixed md:top-0 md:left-0 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=1200&auto=format&fit=crop&q=80&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGNvbnN0cnVjdGlvbiUyMHNpdGV8ZW58MHx8MHx8fDA%3D"
          alt="Construction site"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#218598]/40 via-[#2F3332]/60 to-[#2F3332]/90 mix-blend-multiply" />
        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute bottom-10 left-10 right-10 text-white z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl overflow-hidden shrink-0">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-8 h-8 object-contain drop-shadow-md" />
            </div>
            <span className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              JengaTrack
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
            Build smarter.<br />Track everything.
          </h1>
          <p className="text-white/80 text-base md:text-lg mb-8 font-light max-w-md">
            The ultimate WhatsApp-powered construction management platform for modern builders.
          </p>

          <div className="flex flex-wrap gap-3">
            {LEFT_TAGS.map((tag, i) => (
              <span
                key={i}
                className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-sm font-medium border border-white/20 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="w-full md:w-[55%] md:ml-[45%] min-h-screen bg-background relative flex flex-col justify-center items-center py-12 px-6 md:px-10 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#218598]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#93C54E]/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">

          {/* ── SUCCESS STATE ── */}
          {isSuccess ? (
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#93C54E]/20 to-[#218598]/20 flex items-center justify-center mx-auto border border-[#218598]/20 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-[#218598]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Password updated!</h2>
                <p className="text-muted-foreground">
                  Your password has been set successfully. Redirecting you to sign in…
                </p>
              </div>
              <Button asChild className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg">
                <Link href="/login">Go to Sign In</Link>
              </Button>
            </div>

          ) : (
            /* ── FORM CARD ── */
            <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">

              {/* Header */}
              <div className="space-y-3 mb-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#93C54E]/20 to-[#218598]/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 mx-auto mb-4 border border-[#218598]/20 shadow-inner">
                  <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain drop-shadow-sm" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Set new password</h2>
                <p className="text-muted-foreground">
                  {recoveryToken
                    ? "Choose a strong password to secure your account"
                    : "Check your email for the reset link"}
                </p>
              </div>

              {/* No-token fallback */}
              {!recoveryToken && !error && (
                <div className="space-y-5 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#218598]/10 border border-[#218598]/20 mx-auto">
                    <ShieldCheck className="w-7 h-7 text-[#218598]" />
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Open the link in your reset email to land here with a valid token. If you don't have one, request a new link below.
                  </p>
                  <Button asChild className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg">
                    <Link href="/forgot-password">Request reset link</Link>
                  </Button>
                </div>
              )}

              {/* Error banner (invalid link) */}
              {error && !recoveryToken && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                  <Button asChild className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg">
                    <Link href="/forgot-password">Request new reset link</Link>
                  </Button>
                </div>
              )}

              {/* ── Main form (only when token is valid) ── */}
              {recoveryToken && (
                <form onSubmit={handleReset} className="space-y-5">

                  {/* Inline error */}
                  {error && (
                    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground font-semibold ml-1">New Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className="bg-background/50 border-border/60 rounded-xl h-14 pl-4 pr-12 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {/* Password strength bar */}
                    {password.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="flex-1 h-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor:
                                  strength.score >= i ? strength.color : "rgba(255,255,255,0.1)",
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
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground font-semibold ml-1">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className={`bg-background/50 border-border/60 rounded-xl h-14 pl-4 pr-12 text-foreground transition-all shadow-sm w-full focus:ring-2 ${
                          confirmPassword.length > 0
                            ? passwordsMatch
                              ? "border-[#93C54E]/60 focus:ring-[#93C54E]/30 focus:border-[#93C54E]"
                              : "border-red-500/50 focus:ring-red-500/20 focus:border-red-500"
                            : "focus:ring-[#218598]/50 focus:border-[#218598]"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      >
                        {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                      {confirmPassword.length > 0 && (
                        <div className="absolute right-11 top-1/2 -translate-y-1/2">
                          {passwordsMatch ? (
                            <CheckCircle2 className="h-4 w-4 text-[#93C54E]" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <p className="text-red-400 text-xs ml-1">Passwords do not match</p>
                    )}
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg mt-2"
                    disabled={isLoading || !passwordsMatch}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Updating password…</span>
                      </div>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              )}

              {/* Bottom nav link */}
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
