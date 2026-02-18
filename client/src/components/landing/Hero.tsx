import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(16,185,129,0.15),transparent)]" />
      <div className="container mx-auto px-4 py-24 text-center relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-white mb-6"
        >
          Message Anywhere. Monitor Everywhere.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg sm:text-xl text-zinc-400 mb-10 max-w-2xl mx-auto"
        >
          One place for all your data to manage your construction projects.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-fresh-fern to-ocean-pine hover:opacity-90 text-white px-8 py-6 text-lg font-semibold border-0">
              Get Started
            </Button>
          </Link>
          <Button variant="outline" className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold">
            Learn More
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="grid md:grid-cols-2 gap-4 items-center">
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-2xl">
              <img
                src="/images/hero/whatsapp-phone.png"
                alt="WhatsApp chat interface"
                className="w-full max-w-[280px] mx-auto object-contain"
                loading="eager"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                  t.nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden bg-zinc-800 rounded-lg aspect-[9/16] max-w-[280px] mx-auto flex items-center justify-center text-zinc-500">
                WhatsApp mockup
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-2xl overflow-hidden">
              <img
                src="/images/stock/dashboard-view.png"
                alt="JengaTrack dashboard"
                className="w-full h-auto rounded-lg object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                  t.nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden bg-zinc-800 rounded-lg aspect-video flex items-center justify-center text-zinc-500">
                Dashboard preview
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
