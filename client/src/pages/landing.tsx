import Navigation from "@/components/landing/Navigation";
import Hero from "@/components/landing/Hero";
// Other components will be added here as they are built

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <Hero />
        {/* Placeholder for next sections */}
        <section id="features" className="py-20 bg-secondary/30 flex items-center justify-center">
          <p className="text-muted-foreground font-medium">Features Section (Coming Next...)</p>
        </section>
      </main>
      <footer className="py-12 bg-card border-t border-border text-center">
        <p className="text-muted-foreground">&copy; 2026 BuildMonitor Uganda. All rights reserved.</p>
      </footer>
    </div>
  );
}
