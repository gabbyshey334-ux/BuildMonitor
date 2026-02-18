import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function FinalCTA() {
  const [email, setEmail] = useState("");
  return (
    <section className="py-20 bg-gradient-to-br from-fresh-fern to-ocean-pine">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="font-heading text-4xl lg:text-5xl font-bold text-white mb-6">
            Build Smarter from Day One
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Join the JengaTrack waitlist to get early access, product updates, and behind-the-scenes engineering insights straight to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-3">
              Join
            </Button>
          </div>
          <p className="text-sm text-white/75 mt-4">
            We do not spam. You can unsubscribe at any time.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

