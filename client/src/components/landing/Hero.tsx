import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Users, DollarSign, BarChart3, Star } from "lucide-react";

export default function Hero() {
  const stats = [
    { icon: Users, value: "500+", label: "Active Contractors" },
    { icon: DollarSign, value: "50M+", label: "UGX Tracked" },
    { icon: BarChart3, value: "10,000+", label: "Expenses Logged" },
    { icon: Star, value: "98%", label: "Satisfaction" },
  ];

  return (
    <section className="relative min-h-screen flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(34,197,94,0.12),transparent_70%)]" />
      
      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center pt-28 pb-16 px-4 relative z-10">
        <div className="container mx-auto max-w-7xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight"
          >
            Message Anywhere.
            <br />
            Monitor Everywhere.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-base sm:text-lg text-zinc-400 mb-8 max-w-xl mx-auto"
          >
            Use your favorite chat app to manage your construction project.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
          >
            <Link href="/signup">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white px-6 py-5 text-sm font-semibold rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all duration-300 border-0"
              >
                Start Tracking
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="border border-zinc-700 text-white hover:bg-zinc-800/50 hover:border-zinc-600 px-6 py-5 text-sm font-semibold rounded-lg transition-all duration-300 bg-transparent"
            >
              Learn More
            </Button>
          </motion.div>

          {/* Hero Image - EXTRA WIDE */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
            className="relative w-[90vw] max-w-[1400px] mx-auto"
          >
            {/* Subtle Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-[#22c55e]/10 to-[#14b8a6]/10 rounded-3xl blur-2xl opacity-40" />
            
            {/* Image Container */}
            <div className="relative rounded-xl overflow-hidden bg-transparent">
              <img
                src="/assets/images/hero-mockup.png"
                alt="JengaTrack - WhatsApp chat and Dashboard interface"
                className="relative w-full h-auto max-h-[500px] object-contain"
                loading="eager"
                style={{ 
                  filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.5))',
                  mixBlendMode: 'normal'
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="relative z-10 border-t border-zinc-800/30 bg-[#0a0a0a]"
      >
        <div className="container mx-auto max-w-6xl px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <stat.icon className="w-5 h-5 text-[#22c55e] mb-2" strokeWidth={1.5} />
                <div className="text-xl sm:text-2xl font-bold text-white mb-0.5">
                  {stat.value}
                </div>
                <div className="text-xs text-zinc-500 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}