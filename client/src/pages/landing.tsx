import Navigation from "@/components/landing/Navigation";
import Hero from "@/components/landing/Hero";
import StatsBar from "@/components/landing/Section1_StatsBar";
import ProblemSolution from "@/components/landing/Section2_ProblemSolution";
import HowItWorks from "@/components/landing/Section3_HowItWorks";
import Features from "@/components/landing/Section4_Features";
import DashboardPreview from "@/components/landing/Section5_DashboardPreview";
import Testimonials from "@/components/landing/Section6_Testimonials";
import Pricing from "@/components/landing/Section7_Pricing";
import FAQ from "@/components/landing/Section8_FAQ";
import FinalCTA from "@/components/landing/Section9_FinalCTA";
import Footer from "@/components/landing/Section10_Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <Hero />
        <StatsBar />
        <ProblemSolution />
        <HowItWorks />
        <Features />
        <DashboardPreview />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
