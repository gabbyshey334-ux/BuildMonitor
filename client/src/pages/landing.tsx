import Navigation from "@/components/landing/Navigation";
import Hero from "@/components/landing/Hero";
import StatsBar from "@/components/landing/Section1_StatsBar";
import TurnSiteMessages from "@/components/landing/Section2_TurnSiteMessages";
import HowItWorks from "@/components/landing/Section3_HowItWorks";
import Testimonials from "@/components/landing/Section6_Testimonials";
import Pricing from "@/components/landing/Section7_Pricing";
import FinalCTA from "@/components/landing/Section9_FinalCTA";
import Footer from "@/components/landing/Section10_Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navigation />
      <main>
        <Hero />
        <StatsBar />
        <TurnSiteMessages />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
