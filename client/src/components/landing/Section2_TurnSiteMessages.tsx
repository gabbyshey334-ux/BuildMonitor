import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, BarChart3, Eye, LineChart } from "lucide-react";
import { Link } from "wouter";

export default function TurnSiteMessages() {
  const featureCards = [
    { icon: BarChart3, title: "Built for Real-World Construction." },
    { icon: Eye, title: "Full Oversight & Quality." },
    { icon: LineChart, title: "Sustainable Project Insights." },
  ];

  return (
    <section id="features" className="py-20 bg-zinc-950">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-white mb-4">
            Turn Site Messages Into Structured Control
          </h2>
          <p className="text-lg text-zinc-400 max-w-3xl mx-auto">
            JengaTrack helps you communicate, coordinate, and organize your construction data. Stay on top of your projects, streamline internal communications, and get real-time insights and analytics.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-fresh-fern/20 to-ocean-pine/20 rounded-2xl p-8 border border-emerald-500/20"
          >
            <h3 className="text-2xl font-heading font-bold text-white mb-4">Manage Projects Through Chats</h3>
            <p className="text-zinc-300 mb-6">
              JengaTrack streamlines communication using chat apps like WhatsApp. Send updates, photos, and voice notes—we organize everything automatically.
            </p>
            <Link href="/signup">
              <Button className="bg-white text-zinc-900 hover:bg-zinc-200">Learn More</Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-video flex items-center justify-center group"
          >
            <div className="absolute inset-0 bg-zinc-800/50" />
            <button className="relative z-10 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </button>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {featureCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 hover:border-emerald-500/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <card.icon className="w-6 h-6 text-fresh-fern" />
              </div>
              <h4 className="text-lg font-semibold text-white">{card.title}</h4>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
