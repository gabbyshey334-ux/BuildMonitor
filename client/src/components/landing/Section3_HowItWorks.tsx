import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      step: "1",
      title: "Send site updates",
      description: "Message a purchase, task, or site activity in your chat app",
      image: "/assets/images/step1-chat.png",
      chatPreview: {
        messages: [
          { type: "incoming", text: "Bought 20 bags of cement", time: "10:30 AM" },
          { type: "incoming", text: "Cost: UGX 180,000", time: "10:31 AM" }
        ]
      }
    },
    {
      step: "2",
      title: "Data Updates Automatically",
      description: "JengaTrack logs the information and updates the project database instantly",
      image: "/assets/images/step2-update.png",
      notification: {
        icon: <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />,
        title: "Expense Updated Successfully",
        subtitle: "Today, 10:31am"
      }
    },
    {
      step: "3",
      title: "View or Request Insights",
      description: "Check progress on your dashboard or ask JengaTrack for reports directly in your chat",
      image: "/assets/images/step3-insights.png",
      chartPreview: {
        title: "KDF Apartments Ntungi",
        progress: 75,
        status: "On Track • Month: January"
      }
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#0a0a0a]">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Section Header */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl lg:text-4xl font-bold text-white text-center mb-16"
        >
          How It Works
        </motion.h2>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="bg-[#111111] rounded-2xl border border-zinc-800/50 overflow-hidden hover:border-zinc-700/50 transition-colors"
            >
              {/* Image/Preview Area */}
              <div className="h-48 bg-zinc-900/50 relative p-4 flex items-center justify-center">
                {index === 0 && (
                  /* Chat Preview for Step 1 */
                  <div className="w-full max-w-[240px] bg-[#1a1a1a] rounded-xl p-3 space-y-2 shadow-xl">
                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                      <div className="w-6 h-6 rounded-full bg-[#22c55e]" />
                      <span className="text-xs text-zinc-400">Site Manager</span>
                    </div>
                    {step.chatPreview.messages.map((msg, i) => (
                      <div key={i} className="bg-[#22c55e]/20 rounded-lg p-2 rounded-tl-none">
                        <p className="text-xs text-white">{msg.text}</p>
                        <span className="text-[10px] text-zinc-500">{msg.time}</span>
                      </div>
                    ))}
                  </div>
                )}

                {index === 1 && (
                  /* Notification for Step 2 */
                  <div className="w-full max-w-[240px] bg-[#1a1a1a] rounded-xl p-4 shadow-xl border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
                        {step.notification.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{step.notification.title}</p>
                        <p className="text-xs text-zinc-500">{step.notification.subtitle}</p>
                      </div>
                    </div>
                  </div>
                )}

                {index === 2 && (
                  /* Chart Preview for Step 3 */
                  <div className="w-full max-w-[240px] bg-[#1a1a1a] rounded-xl p-3 shadow-xl border border-zinc-800">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-medium text-[#22c55e]">{step.chartPreview.title}</p>
                        <p className="text-[10px] text-zinc-500">{step.chartPreview.status}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 w-12">Progress</span>
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#14b8a6] to-[#22c55e] rounded-full"
                            style={{ width: `${step.chartPreview.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-r from-[#22c55e] to-[#14b8a6] flex items-center justify-center text-sm font-bold text-white">
                    {step.step}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}