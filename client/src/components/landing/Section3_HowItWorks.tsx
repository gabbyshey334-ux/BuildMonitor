import { motion } from "framer-motion";
import { MessageSquare, Zap, BarChart3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Send a WhatsApp Message",
      description: "Just text your expense like you're messaging a friend. No forms, no apps.",
      code: '"Spent 500,000 on cement"',
      image: "/images/stock/whatsapp-message.png",
      alt: "WhatsApp message example",
      layout: "left",
    },
    {
      number: 2,
      title: "AI Logs It Instantly",
      description: "Our AI understands your message, categorizes it, and logs it automatically.",
      success: "Logged: 500,000 UGX for cement",
      image: "/images/stock/ai-logging.png",
      alt: "AI logging confirmation",
      layout: "right",
    },
    {
      number: 3,
      title: "View Your Dashboard",
      description: "See all your expenses, budgets, and insights in a beautiful real-time dashboard.",
      cta: "See Demo Dashboard",
      image: "/images/stock/dashboard-view.png",
      alt: "Dashboard view",
      layout: "left",
    },
  ];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Simple as 1-2-3
          </h2>
        </motion.div>

        <div className="space-y-16">
          {steps.map((step, index) => {
            const StepImage = () => {
              const [imageError, setImageError] = useState(false);
              const iconMap = {
                1: MessageSquare,
                2: Zap,
                3: BarChart3,
              };
              const Icon = iconMap[step.number as keyof typeof iconMap];

              return (
                <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 overflow-hidden group">
                  {!imageError ? (
                    <>
                      <img
                        src={step.image}
                        alt={step.alt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={() => setImageError(true)}
                      />
                      {/* Professional subtle overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5 pointer-events-none" />
                    </>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      {Icon && <Icon className="w-24 h-24 text-muted-foreground" />}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="grid md:grid-cols-2 gap-8 items-center"
              >
                {/* Content Side */}
                <div className={step.layout === "right" ? "md:order-2" : ""}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-xl">
                      {step.number}
                    </div>
                    <h3 className="text-2xl font-bold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground mb-6">{step.description}</p>

                  {step.code && (
                    <div className="bg-slate-800 rounded-lg p-4 border border-border font-mono text-sm text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      {step.code}
                    </div>
                  )}

                  {step.success && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400 font-medium flex items-center gap-2">
                      <Check className="w-5 h-5" />
                      {step.success}
                    </div>
                  )}

                  {step.cta && (
                    <Link href="/signup">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4">
                        {step.cta}
                      </Button>
                    </Link>
                  )}
                </div>

              {/* Image Side */}
              <div className={step.layout === "right" ? "md:order-1" : ""}>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 transition-all duration-300">
                  <StepImage />
                </div>
              </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

