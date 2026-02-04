import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  TrendingUp,
  Bell,
  Globe,
  Camera,
  FileText,
} from "lucide-react";

export default function Features() {
  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Logging",
      description: "No app needed. Log expenses directly from WhatsApp in seconds.",
    },
    {
      icon: TrendingUp,
      title: "Real-Time Dashboard",
      description: "Beautiful charts update instantly as you log expenses. Always know your budget status.",
    },
    {
      icon: Bell,
      title: "Budget Alerts",
      description: "Get WhatsApp notifications when approaching your budget limit. Never overspend again.",
    },
    {
      icon: Globe,
      title: "Bilingual Support",
      description: "Communicate in English or Luganda. Your team can use it without training.",
    },
    {
      icon: Camera,
      title: "Receipt Images",
      description: "Send receipt photos via WhatsApp. We store them automatically with each expense.",
    },
    {
      icon: FileText,
      title: "Export Reports",
      description: "Download Excel reports for clients, accountants, or your own records anytime.",
    },
  ];

  return (
    <section id="features" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Stay on Budget
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Professional tools, WhatsApp simplicity
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="bg-card border-border hover:shadow-lg hover:shadow-blue-500/10 transition-all h-full">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

