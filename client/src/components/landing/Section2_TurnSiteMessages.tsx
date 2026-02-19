import { motion } from "framer-motion";
import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Features() {
  return (
    <section id="features" className="py-24 bg-[#0a0a0a] relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            Turn Site Messages Into
            <br />
            Structured Control
          </h2>
          <p className="text-lg text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            JengaTrack transforms everyday construction updates into organized trackable data. 
            Using AI and familiar chat apps, it converts informal communication into real-time 
            financial and progress insights
          </p>
        </motion.div>

        {/* Features Grid - 2 rows layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          {/* Main Feature Card - GREEN GRADIENT with Video (Top Left - spans full width on mobile, half on desktop) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-br from-[#0f766e] to-[#22c55e] rounded-3xl p-8 relative overflow-hidden"
          >
            <div className="flex flex-col h-full justify-between">
              <div>
                <Button 
                  className="bg-black/20 hover:bg-black/30 text-white border-0 rounded-full px-6 text-sm backdrop-blur-sm mb-6"
                >
                  Learn More
                </Button>
                
                <h3 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                  Manage Projects Through Chats
                </h3>
                
                <p className="text-white/85 leading-relaxed text-sm max-w-md">
                  Log purchases, labor payments, deliveries, and site updates by sending a 
                  simple message on WhatsApp or Telegram. No spreadsheets. No complicated tools. 
                  Just messages and results.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Video Card (Top Right) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative rounded-3xl overflow-hidden bg-zinc-900 aspect-[4/3] md:aspect-auto"
          >
            <img
              src="/assets/images/construction-team.jpg"
              alt="Construction team collaboration"
              className="w-full h-full object-cover"
            />
            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-16 h-16 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110">
                <Play className="w-6 h-6 text-zinc-900 ml-1" fill="currentColor" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Bottom Row - 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Built for Real-World Construction */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#1a1a1a] rounded-3xl p-6 border border-zinc-800/50"
          >
            {/* Notification Badge */}
            <div className="inline-flex items-center gap-3 bg-zinc-800/80 rounded-full px-4 py-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-[#14b8a6] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-white font-medium">Budget Updated Successfully</p>
                <p className="text-[10px] text-zinc-500">Today, 10:31am</p>
              </div>
            </div>
            
            <h4 className="text-lg font-semibold text-white mb-3">
              Built for Real-World Construction
            </h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Updates can be sent in familiar language, simple text or voice notes. Reducing friction 
              improving adoption across teams.
            </p>
          </motion.div>

          {/* Full Financial Visibility */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-[#1a1a1a] rounded-3xl p-6 border border-zinc-800/50"
          >
            {/* Mini Chart */}
            <div className="mb-6 bg-zinc-800/50 rounded-xl p-4">
              <p className="text-xs text-zinc-400 mb-3">Running Projects</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 w-14">Project A</span>
                  <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full w-[75%] bg-gradient-to-r from-[#14b8a6] to-[#22c55e] rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 w-14">Project B</span>
                  <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full w-[60%] bg-gradient-to-r from-[#14b8a6] to-[#22c55e] rounded-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 w-14">Project C</span>
                  <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full w-[90%] bg-gradient-to-r from-[#14b8a6] to-[#22c55e] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <h4 className="text-lg font-semibold text-white mb-3">
              Full Financial Visibility
            </h4>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Monitor Spending in real time, compare actuals against budgets, and identify 
              overspending before it becomes a crisis.
            </p>
          </motion.div>

          {/* Right Column - Two stacked cards */}
          <div className="flex flex-col gap-6">
            {/* Users Map Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="bg-[#1a1a1a] rounded-3xl p-6 border border-zinc-800/50 flex-1"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex -space-x-2">
                  <img src="/assets/images/avatar-1.jpg" alt="User" className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] object-cover" />
                  <img src="/assets/images/avatar-2.jpg" alt="User" className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] object-cover" />
                  <img src="/assets/images/avatar-3.jpg" alt="User" className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] object-cover" />
                  <img src="/assets/images/avatar-4.jpg" alt="User" className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] object-cover" />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Our users span across different countries in Africa.
              </p>
            </motion.div>

            {/* Actionable Project Insights - GREEN */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="bg-gradient-to-br from-[#14b8a6] to-[#22c55e] rounded-3xl p-6 relative overflow-hidden flex-1"
            >
              <h4 className="text-lg font-semibold text-white mb-3">
                Actionable Project Insights
              </h4>
              <p className="text-white/90 text-sm leading-relaxed">
                Identify risks, track patterns, and operational inefficiencies. Transform raw data 
                into structured insights that support faster, smarter decisions.
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}