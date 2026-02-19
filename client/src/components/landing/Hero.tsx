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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(34,197,94,0.15),transparent_70%)]" />
      
      {/* Hero Content */}
      <div className="flex-1 flex flex-col items-center justify-center pt-32 pb-20 px-4 relative z-10">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
          >
            Message Anywhere.
            <br />
            Monitor Everywhere.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto"
          >
            Use your favorite chat app to manage your construction project.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Link href="/signup">
              <Button 
                className="bg-gradient-to-r from-[#22c55e] to-[#14b8a6] hover:opacity-90 text-white px-8 py-6 text-base font-semibold rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] transition-all duration-300 border-0"
              >
                Start Tracking
              </Button>
            </Link>
            <Button 
              variant="outline" 
              className="border border-zinc-700 text-white hover:bg-zinc-800/50 hover:border-zinc-600 px-8 py-6 text-base font-semibold rounded-lg transition-all duration-300 bg-transparent"
            >
              Learn More
            </Button>
          </motion.div>

          {/* App Mockups */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
            className="relative max-w-5xl mx-auto"
          >
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
              {/* Phone Mockup */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#22c55e]/20 to-[#14b8a6]/20 rounded-[2.5rem] blur-xl opacity-60" />
                <div className="relative bg-zinc-900 rounded-[2rem] p-3 border border-zinc-800 shadow-2xl">
                  <img
                    src="/assets/images/phone-chat.png"
                    alt="WhatsApp chat interface showing construction updates"
                    className="w-[280px] h-auto rounded-[1.5rem] object-cover"
                    loading="eager"
                  />
                  {/* Chat Bubbles Overlay */}
                  <div className="absolute inset-0 rounded-[1.5rem] overflow-hidden pointer-events-none">
                    <div className="absolute top-20 left-4 right-4 space-y-2">
                      <div className="bg-[#22c55e]/90 text-white text-xs p-2 rounded-lg rounded-tl-none max-w-[80%] backdrop-blur-sm">
                        Bought 20 bags of cement
                      </div>
                      <div className="bg-[#22c55e]/90 text-white text-xs p-2 rounded-lg rounded-tl-none max-w-[80%] backdrop-blur-sm">
                        Cost: UGX 180,000
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dashboard Mockup */}
              <div className="relative hidden md:block">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#14b8a6]/20 to-[#22c55e]/20 rounded-2xl blur-xl opacity-60" />
                <div className="relative bg-zinc-900 rounded-2xl p-4 border border-zinc-800 shadow-2xl">
                  <img
                    src="/assets/images/dashboard.png"
                    alt="JengaTrack dashboard showing project analytics"
                    className="w-[500px] h-auto rounded-xl object-cover"
                    loading="eager"
                  />
                  {/* Dashboard UI Overlay Elements */}
                  <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22c55e] to-[#14b8a6]" />
                      <span className="text-white text-sm font-medium">Sarah Jones</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                      <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="relative z-10 border-t border-zinc-800/50 bg-[#0a0a0a]/80 backdrop-blur-sm"
      >
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <stat.icon className="w-6 h-6 text-[#22c55e] mb-3" strokeWidth={1.5} />
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}