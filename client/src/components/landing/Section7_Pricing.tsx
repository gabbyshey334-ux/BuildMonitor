import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free Plan",
      description: "Ideal for small projects or trial use.",
      price: { monthly: 0, yearly: 0 },
      features: ["1 project", "1 GB storage", "Basic Analytics", "2 users Max", "Standard support"],
      cta: "Sign Up",
      highlighted: false,
    },
    {
      name: "Pro Plan",
      badge: "MOST POP",
      description: "Designed for growing teams managing multiple projects.",
      price: { monthly: 24, yearly: 19 },
      features: ["Up to 5 projects", "50 GB storage", "Advanced Analytics", "Up to 15 users", "Standard support"],
      cta: "Get Started",
      highlighted: true,
    },
    {
      name: "Enterprise",
      description: "Designed for large-scale operations, with full-scale oversight.",
      price: "Custom",
      features: ["Unlimited projects & storage", "Full analytics suite", "Unlimited number of users", "Custom integrations", "Dedicated 24/7 support"],
      cta: "Contact Us",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Start Managing <span className="text-[#22c55e]">Smarter</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Whether you're managing a single site or multiple projects, JengaTrack scales with you.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm ${!isYearly ? "text-white" : "text-zinc-500"}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-12 h-6 bg-zinc-700 rounded-full transition-colors"
            >
              <div className={`absolute top-1 w-4 h-4 bg-[#22c55e] rounded-full transition-all ${isYearly ? "left-7" : "left-1"}`} />
            </button>
            <span className={`text-sm ${isYearly ? "text-white" : "text-zinc-500"}`}>
              Annually
              <span className="ml-2 px-2 py-0.5 bg-[#22c55e]/20 text-[#22c55e] text-xs rounded-full">Save 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-[#1a1a1a] rounded-3xl p-4 border border-zinc-800/50 flex flex-col"
            >
              {/* Inner Box - Plan Details - FIXED HEIGHT */}
              <div className={`rounded-2xl p-6 text-center flex flex-col justify-between min-h-[280px] ${plan.highlighted ? "bg-gradient-to-br from-[#14b8a6] to-[#22c55e]" : "bg-[#111111]"}`}>
                <div>
                  {plan.badge && (
                    <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full mb-3">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className={`text-sm min-h-[40px] ${plan.highlighted ? "text-white/80" : "text-zinc-400"}`}>
                    {plan.description}
                  </p>
                </div>
                
                {/* Price */}
                <div className="my-4">
                  {plan.price === "Custom" ? (
                    <span className="text-4xl font-bold text-white">Custom</span>
                  ) : (
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-white">
                        ${isYearly ? plan.price.yearly : plan.price.monthly}
                      </span>
                      <span className={`text-sm ${plan.highlighted ? "text-white/70" : "text-zinc-500"}`}>
                        /month
                      </span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Link href={plan.cta === "Contact Us" ? "#contact" : "/signup"} className="block mt-auto">
                  <Button
                    className="w-full py-3 rounded-xl font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-all"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>

              {/* Benefits Section */}
              <div className="px-2 pb-2 pt-6 flex-1">
                <p className="text-sm font-semibold text-white mb-4">Benefits</p>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                      <span className="text-zinc-500">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}