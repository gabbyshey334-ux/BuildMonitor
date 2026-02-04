import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
  const plans = [
    {
      name: "Free Trial",
      price: "0",
      period: "14 days",
      tagline: "Perfect for testing",
      features: [
        "Unlimited expenses",
        "1 project",
        "WhatsApp support",
        "Dashboard access",
      ],
      cta: "Start Free Trial",
      ctaVariant: "outline" as const,
      highlighted: false,
    },
    {
      name: "Starter",
      price: "30,000",
      period: "month",
      tagline: "For solo contractors",
      features: [
        "Everything in Free",
        "Unlimited projects",
        "Receipt images",
        "Export reports",
        "Priority support",
      ],
      cta: "Get Started",
      ctaVariant: "default" as const,
      highlighted: true,
      badge: "Most Popular",
    },
    {
      name: "Professional",
      price: "75,000",
      period: "month",
      tagline: "For growing teams",
      features: [
        "Everything in Starter",
        "Multi-user access",
        "Advanced analytics",
        "Custom categories",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      ctaVariant: "outline" as const,
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade as you grow
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card
                className={`bg-card border-border h-full flex flex-col ${
                  plan.highlighted
                    ? "border-primary border-2 shadow-lg shadow-primary/10"
                    : ""
                }`}
              >
                <CardHeader className="text-center">
                  {plan.badge && (
                    <Badge className="mb-2 bg-primary text-primary-foreground">
                      {plan.badge}
                    </Badge>
                  )}
                  <CardTitle className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      UGX / {plan.period}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Link href="/signup" className="w-full">
                    <Button
                      variant={plan.ctaVariant}
                      className={`w-full ${
                        plan.highlighted
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                          : ""
                      }`}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-muted-foreground mt-8"
        >
          All plans include 14-day free trial. No credit card required.
        </motion.p>
      </div>
    </section>
  );
}

