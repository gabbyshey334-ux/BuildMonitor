import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { Link } from "wouter";

export default function FinalCTA() {
  return (
    <section className="py-20 bg-brand-gradient">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="font-heading text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Take Control of Your Construction Budget?
          </h2>
          <p className="font-body text-xl text-white/90 mb-8">
            Join 500+ contractors who save hours every week
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-white text-ocean-pine hover:bg-ash-gray px-8 py-6 text-lg min-h-[56px] font-heading font-semibold shadow-lg"
              >
                Start Free Trial
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg min-h-[56px] font-heading font-semibold"
            >
              <Play className="w-5 h-5 mr-2 fill-current" />
              Watch 2-Min Demo
            </Button>
          </div>

          <p className="font-body text-sm text-white/75">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  );
}

