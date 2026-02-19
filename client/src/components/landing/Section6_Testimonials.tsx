import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Daniel Okoye",
      role: "Quantity Surveyor",
      quote: "The progress vs expenditure comparison is incredibly practical. It highlights savings and overspending in seconds without digging through spreadsheets."
    },
    {
      name: "Sarah Kimani",
      role: "Project Manager",
      quote: "This dashboard made it obvious where our costs were drifting before it became a crisis. It's simple, visual, and brutally honest."
    },
    {
      name: "Michael Mylo",
      role: "Operations Director",
      quote: "We've reduced unnecessary cost overruns because the imbalance becomes visible early. It encourages accountability."
    },
    {
      name: "James Mwangi",
      role: "Development Planner",
      quote: "The clarity of the visual metrics helped us make faster decisions. It's practical, professional, and very effective."
    },
    {
      name: "Ruth Nambatya",
      role: "Site Engineer",
      quote: "It's refreshing to see a financial tool that aligns directly with project progress. It keeps the team focused on both performance and discipline."
    },
    {
      name: "Lydia Anderson",
      role: "Construction Consultant",
      quote: "I appreciate how clearly the system flags risk. The colour logic makes reporting to stakeholders much easier."
    }
  ];

  return (
    <section className="py-24 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Section Header */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl lg:text-4xl font-bold text-white text-center mb-4"
        >
          What Our Users
          <br />
          Are Saying
        </motion.h2>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-gradient-to-br from-[#0f766e] to-[#115e59] rounded-2xl p-6 border border-teal-500/20 hover:border-teal-400/40 transition-all duration-300 group"
            >
              {/* User Info */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={`/assets/images/avatar-${t.name.toLowerCase().split(" ")[0]}.jpg`}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/20 group-hover:border-white/40 transition-colors"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div 
                  className="w-10 h-10 rounded-full bg-white/20 items-center justify-center text-white text-sm font-semibold border-2 border-white/20 hidden"
                >
                  {t.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{t.name}</p>
                  <p className="text-xs text-teal-100/70">{t.role}</p>
                </div>
              </div>
              
              {/* Quote */}
              <p className="text-teal-50/90 text-sm leading-relaxed">
                "{t.quote}"
              </p>
            </motion.div>
          ))}
        </div>

        {/* See All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-10"
        >
          <Button 
            className="bg-gradient-to-r from-[#14b8a6] to-[#22c55e] hover:opacity-90 text-white border-0 rounded-lg px-8 py-2 shadow-[0_0_20px_rgba(20,184,166,0.3)]"
          >
            See All
          </Button>
        </motion.div>
      </div>
    </section>
  );
}