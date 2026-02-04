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
    <section className="relative pt-20 pb-12 sm:pt-32 sm:pb-20 lg:pt-48 lg:pb-32 bg-gradient-to-br from-background via-secondary to-background overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 -z-10 opacity-10 dark:opacity-5">
        <div className="w-[500px] h-[500px] bg-primary rounded-full blur-[100px] -mr-48 -mt-48" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10 opacity-10 dark:opacity-5">
        <div className="w-[400px] h-[400px] bg-primary rounded-full blur-[80px] -ml-24 -mb-24" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Content - Text (Full width on mobile, centered) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center md:text-left max-w-2xl mx-auto md:max-w-none md:mx-0"
          >
            <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              Trusted by 50+ Ugandan Contractors
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-foreground leading-[1.1] mb-4 sm:mb-6">
              Track Your Construction Budget.{" "}
              <span className="text-primary">Right from WhatsApp.</span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 md:mb-10 leading-relaxed max-w-xl mx-auto md:mx-0">
              No app downloads. No training. Just send a message and watch your 
              project finances come to life on a beautiful real-time dashboard.
            </p>

            {/* Key Benefits */}
            <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10 flex flex-col items-center md:items-start">
              {[
                "Log expenses in seconds via WhatsApp",
                "Real-time budget tracking dashboard",
                "Works in English and Luganda"
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center text-sm sm:text-base text-foreground font-medium w-full md:w-auto justify-center md:justify-start"
                >
                  <div className="bg-primary/10 p-1 rounded-full mr-3 flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span>{benefit}</span>
                </motion.div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center md:justify-start">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-xl">
                  Start Free Trial
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 border-2 hover:bg-accent">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2 fill-current" />
                Watch Demo
              </Button>
            </div>

            <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-muted-foreground font-medium italic text-center md:text-left">
              * No credit card required. Cancel anytime.
            </p>
          </motion.div>

          {/* Right Column - Hero Image (Hidden on Mobile, Visible on Tablet+) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="hidden md:flex relative items-center justify-center lg:justify-end"
          >
            {/* Floating Animation for Desktop */}
            <motion.div
              animate={{ y: [0, -15, 0] }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative w-full max-w-[500px] sm:max-w-[600px] md:max-w-[650px] lg:max-w-[700px] xl:max-w-[750px] mx-auto lg:mx-0"
            >
              <img
                src="/images/hero/whatsapp-phone.png"
                alt="JengaTrack WhatsApp expense tracking on mobile"
                className="w-full h-auto object-contain"
                style={{
                  // Remove background, allow transparency
                  mixBlendMode: 'normal',
                  backgroundColor: 'transparent',
                  // Keep shadow but lighter for transparent backgrounds
                  filter: 'drop-shadow(0 20px 40px -10px rgba(0, 0, 0, 0.15))',
                }}
                loading="eager"
                onError={(e) => {
                  console.error('Hero image failed to load:', e);
                  console.error('Expected path: /images/hero/whatsapp-phone.png');
                  console.error('Make sure the image is in: client/public/images/hero/whatsapp-phone.png');
                }}
                onLoad={() => {
                  console.log('Hero image loaded successfully');
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

