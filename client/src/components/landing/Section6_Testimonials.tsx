import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Testimonials() {
  const testimonials = [
    { name: "Daniel Okello", role: "Quantity Surveyor", quote: "JengaTrack transformed how we track expenses. Simple and effective." },
    { name: "Sarah Kamau", role: "Project Manager", quote: "Finally, a tool that understands construction workflows." },
    { name: "Michael Kyalo", role: "Construction Lead", quote: "Our team adoption was instant. WhatsApp integration is brilliant." },
    { name: "James Mwangi", role: "Development Manager", quote: "Real-time insights help us stay on budget every time." },
    { name: "Luis Anderson", role: "IT Manager", quote: "Seamless integration with our existing tools. Highly recommended." },
    { name: "Lydia Anderson", role: "Executive Director", quote: "The best construction management investment we've made." },
  ];

  return (
    <section className="py-20 bg-zinc-950">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-white mb-4">
            What Our Users Are Saying
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 hover:border-emerald-500/30 transition-colors"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-white font-semibold">
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                  <p className="text-sm text-zinc-400">{t.role}</p>
                </div>
              </div>
              <p className="text-zinc-300 italic">"{t.quote}"</p>
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Button variant="outline" className="border-fresh-fern text-fresh-fern hover:bg-fresh-fern/10">
            Read More
          </Button>
        </div>
      </div>
    </section>
  );
}

