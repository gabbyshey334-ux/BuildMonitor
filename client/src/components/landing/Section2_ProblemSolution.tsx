import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { X, Check } from "lucide-react";

export default function ProblemSolution() {
  const problems = [
    {
      problem: "Manual Entry Delays",
      problemText: "Writing expenses in notebooks means you forget to log them. By the time you remember, receipts are lost.",
      solution: "Log in 10 seconds via WhatsApp",
      icon: X,
    },
    {
      problem: "No Budget Visibility",
      problemText: "You only realize you're over budget when the project is halfway done. Too late to adjust.",
      solution: "Live dashboard shows remaining budget",
      icon: X,
    },
    {
      problem: "Language Barriers",
      problemText: "Your team speaks Luganda, but the app is only in English. Training takes weeks.",
      solution: "Works in English and Luganda",
      icon: X,
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Why Ugandan Contractors Lose Money
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Traditional budget tracking methods create costly gaps
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="bg-card border-border hover:border-primary transition-colors h-full">
                <CardContent className="p-6">
                  {/* Problem Section */}
                  <div className="mb-6">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {item.problem}
                    </h3>
                    <p className="text-muted-foreground">{item.problemText}</p>
                  </div>

                  {/* Solution Section */}
                  <div className="pt-6 border-t border-border">
                    <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                      <Check className="w-6 h-6 text-green-500" />
                    </div>
                    <p className="text-foreground font-medium">{item.solution}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

