import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";

function AnimatedCounter({ end, duration = 2 }: { end: number; duration?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export default function StatsBar() {
  const stats = [
    { value: 500, suffix: "+", label: "Active Contractors", icon: "👷" },
    { value: 50, suffix: "M+", label: "UGX Tracked", icon: "💰" },
    { value: 10000, suffix: "+", label: "Expenses Logged", icon: "📊" },
    { value: 98, suffix: "%", label: "Satisfaction", icon: "⭐" },
  ];

  return (
    <section className="py-8 bg-gradient-to-r from-fresh-fern/20 via-ocean-pine/20 to-fresh-fern/20 border-y border-zinc-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex items-center justify-center gap-3"
            >
              <div className="text-2xl">{stat.icon}</div>
              <span className="text-lg lg:text-xl font-heading font-semibold text-white">
                <AnimatedCounter end={stat.value} />
                {stat.suffix} {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

