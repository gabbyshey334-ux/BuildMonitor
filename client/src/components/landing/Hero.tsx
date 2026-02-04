// TO UPDATE HERO IMAGE:
// 1. Save your generated image as: public/images/hero/whatsapp-phone.png
// 2. Image should be high-res PNG or JPG (at least 1200x1600px)
// 3. Compress image to < 500KB using tinypng.com before uploading

import { Button } from "@/components/ui/button";
import { Check, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-brand-gradient overflow-hidden">
      <div className="container mx-auto px-4 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Headline + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-white"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm font-heading font-semibold mb-6">
              <span className="flex h-2 w-2 rounded-full bg-fresh-fern mr-2 animate-pulse" />
              Trusted by 50+ Ugandan Contractors
            </div>
            
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Track Your Construction Budget.
              <span className="block text-fresh-fern">Right from WhatsApp.</span>
            </h1>
            
            <p className="font-body text-lg sm:text-xl mb-8 text-white/90 leading-relaxed max-w-xl">
              Log expenses in seconds. View insights instantly. Keep your projects on budget—no app download needed.
            </p>

            {/* Key Benefits */}
            <div className="space-y-3 mb-10">
              {[
                "Log expenses in seconds via WhatsApp",
                "Real-time budget tracking dashboard",
                "Works in English and Luganda",
              ].map((benefit, i) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="flex items-center gap-3 font-body text-base sm:text-lg text-white/95"
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15">
                    <Check className="w-4 h-4 text-fresh-fern" />
                  </span>
                  <span>{benefit}</span>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-ocean-pine font-heading font-semibold px-8 py-6 rounded-lg hover:bg-ash-gray transition-all shadow-lg"
                >
                  Start Free Trial
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-2 border-white text-white font-heading font-semibold px-8 py-6 rounded-lg hover:bg-white/10 transition-all"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Right: Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
            className="relative"
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative max-w-[560px] mx-auto"
            >
              <img
                src="/images/hero/whatsapp-phone.png"
                alt="JengaTrack WhatsApp expense tracking on mobile"
                className="w-full h-auto object-contain"
                style={{
                  mixBlendMode: "normal",
                  backgroundColor: "transparent",
                  filter: "drop-shadow(0 30px 60px -18px rgba(0, 0, 0, 0.35))",
                }}
                loading="eager"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Decorative gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

