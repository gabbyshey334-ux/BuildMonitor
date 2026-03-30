import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    whatsappNumber: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const { register, isLoading } = useAuth();

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

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      await register(formData);
    } catch (error) {
      console.error("Signup error:", error);
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
          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
            {/* Header */}
            <div className="space-y-3 mb-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#93C54E]/20 to-[#218598]/20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 mx-auto mb-4 border border-[#218598]/20 shadow-inner">
                <img src="/assets/images/logo.png" alt="JengaTrack" className="w-10 h-10 object-contain drop-shadow-sm" />
              </div>
              <h2 className="text-3xl font-bold text-foreground tracking-tight">Create account</h2>
              <p className="text-muted-foreground">Start tracking your build today</p>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground font-semibold ml-1">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  maxLength={100}
                  className="bg-background/50 border-border/60 rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                />
                {errors.fullName && <p className="text-red-500 text-xs mt-1 ml-1">{errors.fullName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNumber" className="text-foreground font-semibold ml-1">WhatsApp Number</Label>
                <Input
                  id="whatsappNumber"
                  type="tel"
                  value={formData.whatsappNumber}
                  onChange={handleInputChange}
                  placeholder="+256..."
                  required
                  maxLength={15}
                  className="bg-background/50 border-border/60 rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                />
                {errors.whatsappNumber && <p className="text-red-500 text-xs mt-1 ml-1">{errors.whatsappNumber}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-semibold ml-1">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@example.com"
                  required
                  maxLength={254}
                  className="bg-background/50 border-border/60 rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1 ml-1">{errors.email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-semibold ml-1">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="bg-background/50 border-border/60 rounded-xl h-12 pl-4 pr-12 text-foreground focus:ring-2 focus:ring-[#218598]/50 focus:border-[#218598] transition-all shadow-sm w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1 ml-1">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-14 bg-gradient-to-r from-[#93C54E] to-[#218598] hover:from-[#85b546] hover:to-[#1d7586] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login">
                  <span className="text-[#218598] hover:text-[#1a6a7a] font-bold cursor-pointer transition-colors">
                    Sign in here
                  </span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
