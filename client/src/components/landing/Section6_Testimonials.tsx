import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

export default function Testimonials() {
  const testimonials = [
    {
      initials: "JM",
      quote: "JengaTrack saved me 2 hours every day. I just text my expenses and focus on the work.",
      name: "John Mugisha",
      role: "General Contractor, Kampala",
      rating: 5,
    },
    {
      initials: "SN",
      quote: "The Luganda support means my team can use it without training. Game changer.",
      name: "Sarah Nakato",
      role: "Home Builder, Entebbe",
      rating: 5,
    },
    {
      initials: "DK",
      quote: "I always know exactly how much budget I have left. No more surprises.",
      name: "David Katende",
      role: "Renovation Specialist, Jinja",
      rating: 5,
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
            What Ugandan Contractors Say
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="bg-card border-border h-full">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">
                      {testimonial.initials}
                    </div>
                    <div className="flex-1">
                      <Quote className="w-6 h-6 text-muted-foreground mb-2" />
                      <p className="text-foreground italic mb-4">
                        "{testimonial.quote}"
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-1 mb-2">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="font-semibold text-foreground">
                      {testimonial.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </p>
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

