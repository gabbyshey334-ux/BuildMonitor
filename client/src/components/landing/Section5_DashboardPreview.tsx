import { motion } from "framer-motion";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPreview() {
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
            Your Construction Budget at a Glance
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="bg-card border border-border rounded-lg overflow-hidden p-4 md:p-8">
            <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src="/images/dashboard-preview.png"
                alt="JengaTrack Dashboard Preview"
                className="w-full h-full object-contain max-w-7xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
              {/* Fallback icon (shown if image fails to load) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <LayoutDashboard className="w-24 h-24 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Dashboard Screenshot</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

