import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: "Free Plan",
      price: "$0",
      period: "/ month",
      features: ["1 Project", "50 MB Storage", "Basic Reports", "2 Users Max", "Standard support"],
      cta: "Sign Up",
      highlighted: false,
    },
    {
      name: "Pro Plan",
      sublabel: "Pro Plus",
      price: "$24",
      period: "/ month",
      features: ["5 Projects", "1 TB Storage", "Advanced Analytics", "Up to 10 Users", "Premium support"],
      cta: "Get Started",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      features: ["Unlimited projects/Storage", "Unlimited number of users", "Custom Integrations", "Dedicated 24/7 support"],
      cta: "Contact Us",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-zinc-950">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-heading font-bold text-white mb-4">
            Start Managing <span className="text-fresh-fern">Smarter</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Whether you're managing a single site or multiple projects, JengaTrack grows with you.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!isYearly ? "bg-gradient-to-r from-fresh-fern to-ocean-pine text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Per Month
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isYearly ? "bg-gradient-to-r from-fresh-fern to-ocean-pine text-white" : "text-zinc-400 hover:text-white"}`}
            >
              Per Year
            </button>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`h-full border ${plan.highlighted ? "border-fresh-fern bg-gradient-to-b from-fresh-fern/10 to-ocean-pine/10" : "border-zinc-800 bg-zinc-900"}`}>
                <CardHeader className="text-center">
                  {plan.sublabel && <p className="text-sm text-fresh-fern font-medium">{plan.sublabel}</p>}
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-2xl font-bold text-white">
                    {plan.price}
                    <span className="text-zinc-400 font-normal text-base">{plan.period}</span>
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-zinc-300">
                        <Check className="w-5 h-5 text-fresh-fern flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href={plan.cta === "Contact Us" ? "#contact" : "/signup"} className="w-full">
                    <Button
                      className={`w-full ${plan.highlighted ? "bg-gradient-to-r from-fresh-fern to-ocean-pine text-white border-0" : "bg-transparent border-2 border-fresh-fern text-fresh-fern hover:bg-fresh-fern/10"}`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
