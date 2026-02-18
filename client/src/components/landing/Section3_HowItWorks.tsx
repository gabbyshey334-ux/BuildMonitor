import { motion } from "framer-motion";
import { MessageSquare, Settings, BarChart3 } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    { icon: MessageSquare, title: "Send site updates", description: "Send updates via WhatsApp—text, photos, or voice notes." },
    { icon: Settings, title: "Data Processed Automatically", description: "JengaTrack organizes and categorizes your data in real time." },
    { icon: BarChart3, title: "View or Receive Insights", description: "Access your dashboard or get insights delivered to you." },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-zinc-950">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-white mb-4">How It Works</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-fresh-fern" />
              </div>
              <p className="text-lg font-semibold text-white mb-2">
                {index + 1}. {step.title}
              </p>
              <p className="text-zinc-400 text-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
