import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { User, Mail, Lock, Phone, Eye, EyeOff, Loader2 } from "lucide-react";

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

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    whatsappNumber: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, isLoading } = useAuth();

  const strength = getPasswordStrength(formData.password);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};

    const fullNameTrim = formData.fullName.trim();
    if (!fullNameTrim) {
      next.fullName = "Full name is required";
    } else if (fullNameTrim.length > 100) {
      next.fullName = "Name must be under 100 characters";
    }

    const emailTrim = formData.email.trim();
    if (!emailTrim) {
      next.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrim)) {
        next.email = "Please enter a valid email address";
      }
    }
    if (emailTrim.length > 254) {
      next.email = "Please enter a valid email address";
    }

    const whatsappTrim = formData.whatsappNumber.trim();
    if (!whatsappTrim) {
      next.whatsappNumber = "WhatsApp number is required";
    }

    if (!formData.password) {
      next.password = "Password is required";
    } else if (formData.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }

    if (formData.password && formData.password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await register(formData);
    } catch (error) {
      console.error("Signup error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1A14] relative overflow-x-hidden">

      {/* ── Desktop: full-page SVG grid background ── */}
      <div className="hidden md:block absolute inset-0 opacity-[0.04] pointer-events-none overflow-hidden">
        <GridPattern id="grid-signup-d" />
      </div>

      {/* ── Mobile only: Zone A — Brand Panel (fixed, top 38vh) ── */}
      <div className="md:hidden fixed top-0 inset-x-0 h-[38vh] bg-[#0F1A14] z-[1] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none">
          <GridPattern id="grid-signup-m" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/50 shadow-[0_0_20px_rgba(30,122,62,0.25)] flex items-center justify-center overflow-hidden bg-white/5">
            <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">JengaTrack</span>
          <p className="text-sm text-[#F59E0B]">Start tracking in under 2 minutes.</p>
        </div>
      </div>

      {/* ── Zone B — Form card ── */}
      <div className="relative z-10 mt-[calc(38vh-20px)] md:mt-0 md:flex md:items-center md:justify-center md:min-h-screen md:px-6">
        <div className="bg-white w-full rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.08)] md:rounded-2xl md:shadow-2xl md:max-w-md px-6 pt-8 pb-10 md:p-10 min-h-[calc(65vh+20px)] md:min-h-0">

          {/* Desktop-only logo header */}
          <div className="hidden md:flex flex-col items-center mb-8 gap-2">
            <div className="w-14 h-14 rounded-xl border border-[#1E7A3E]/40 shadow-sm flex items-center justify-center overflow-hidden">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#0F1A14]">JengaTrack</span>
          </div>

          {/* Form heading */}
          <h2 className="text-2xl font-bold tracking-tight text-[#0F1A14]">Create your account</h2>
          <p className="text-sm text-gray-500 mt-1">Free to start. No credit card.</p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">

            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  maxLength={100}
                  className={`h-[52px] pl-10 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${errors.fullName ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.fullName}</p>
              )}
            </div>

            {/* WhatsApp Number */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsappNumber" className="text-sm font-medium text-gray-700">
                WhatsApp Number
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="whatsappNumber"
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={handleInputChange}
                  placeholder="+256 700 000 000"
                  required
                  maxLength={15}
                  className={`h-[52px] pl-10 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${errors.whatsappNumber ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
                />
              </div>
              {errors.whatsappNumber && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.whatsappNumber}</p>
              )}
            </div>

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
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                  className={`h-[52px] pl-10 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${errors.email ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password + strength indicator */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className={`h-[52px] pl-10 pr-12 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${errors.password ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
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
              {errors.password && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.password}</p>
              )}

              {/* 4-segment strength bar */}
              {formData.password.length > 0 && (
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
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className={`h-[52px] pl-10 pr-12 bg-[#F8FAF9] rounded-xl focus-visible:ring-2 focus-visible:ring-[#1E7A3E]/30 focus-visible:border-[#1E7A3E] text-[#0F1A14] placeholder:text-gray-400 ${errors.confirmPassword ? "border-[#DC2626]" : "border-[#E5E7EB]"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 min-h-[44px] flex items-center"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.confirmPassword}</p>
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
                  Creating account…
                </span>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Terms */}
          <p className="text-xs text-gray-500 text-center mt-3 leading-relaxed">
            By signing up you agree to our{" "}
            <span className="text-[#1E7A3E] cursor-pointer hover:underline underline-offset-2">Terms</span>
            {" "}and{" "}
            <span className="text-[#1E7A3E] cursor-pointer hover:underline underline-offset-2">Privacy Policy</span>
          </p>

          {/* Bottom link */}
          <p className="text-sm text-gray-500 text-center mt-4">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-[#1E7A3E] font-medium cursor-pointer hover:underline underline-offset-2">
                Sign in
              </span>
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
