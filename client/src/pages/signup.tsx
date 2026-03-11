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
      <div className="relative w-full md:w-[45%] h-[260px] md:h-screen md:fixed md:top-0 md:left-0 bg-[#1a2e1a] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1531834685032-c34bf0d84c77?w=1200&auto=format&fit=crop&q=80&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGNvbnN0cnVjdGlvbiUyMHNpdGV8ZW58MHx8MHx8fDA%3D" 
          alt="Construction site" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        
        {/* Bottom Content */}
        <div className="absolute bottom-10 left-10 right-10 text-white z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30 overflow-hidden shrink-0">
              <img src="/assets/images/logo.png" alt="JengaTrack" className="w-7 h-7 object-contain mix-blend-multiply dark:mix-blend-lighten" />
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
              <span key={i} className="px-3 py-1 rounded-full bg-white/20 text-xs font-medium border border-white/10">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - Form Side */}
      <div className="w-full md:w-[55%] md:ml-[45%] min-h-screen bg-background flex flex-col justify-center items-center py-12 px-6 md:px-10">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Logo & Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                <img src="/assets/images/logo.png" alt="JengaTrack" className="w-5 h-5 object-contain mix-blend-multiply dark:mix-blend-lighten" />
              </div>
              <span className="font-bold text-foreground">JengaTrack</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="text-muted-foreground text-sm">Start tracking your build today</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-foreground font-medium">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="John Doe"
                required
                maxLength={100}
                className="bg-muted border-border rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappNumber" className="text-foreground font-medium">WhatsApp Number</Label>
              <Input
                id="whatsappNumber"
                type="tel"
                value={formData.whatsappNumber}
                onChange={handleInputChange}
                placeholder="+256..."
                required
                maxLength={15}
                className="bg-muted border-border rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
              />
              {errors.whatsappNumber && <p className="text-red-500 text-xs mt-1">{errors.whatsappNumber}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="name@example.com"
                required
                maxLength={254}
                className="bg-muted border-border rounded-xl h-12 px-4 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="bg-muted border-border rounded-xl h-12 pl-4 pr-12 text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors text-base"
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

          <p className="text-center text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-cyan-500 hover:text-cyan-600 font-medium cursor-pointer transition-colors">
                Sign in
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
