import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinalCTA() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      toast({
        title: "You're on the list!",
        description: "We'll notify you when we launch.",
      });
      setEmail("");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't join waitlist",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="waitlist" className="py-24 bg-gradient-to-r from-[#0f766e] via-[#14b8a6] to-[#22c55e] relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            {t("landing.cta.title")}
          </h2>
          <p className="text-lg text-white/85 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("landing.cta.waitlistDesc")}
          </p>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
            <input
              type="email"
              placeholder={t("landing.cta.enterEmail")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-6 py-4 rounded-xl bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-lg"
            />
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="bg-black hover:bg-zinc-800 text-white px-10 py-4 rounded-xl font-medium shadow-lg transition-all hover:scale-105 disabled:opacity-70"
            >
              {isSubmitting ? t("landing.cta.submitting") : t("landing.cta.button")}
            </Button>
          </form>
          
          <p className="text-sm text-white/70 mt-6">
            {t("landing.cta.waitlistNote")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}