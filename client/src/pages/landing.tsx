import Navigation from "@/components/landing/Navigation";
import Hero from "@/components/landing/Hero";
import TurnSiteMessages from "@/components/landing/Section2_TurnSiteMessages";
import HowItWorks from "@/components/landing/Section3_HowItWorks";
import Pricing from "@/components/landing/Section7_Pricing";
import Testimonials from "@/components/landing/Section6_Testimonials";
import FinalCTA from "@/components/landing/Section9_FinalCTA";
import SectionBlog from "@/components/landing/Section_Blog";
import Footer from "@/components/landing/Section10_Footer";

export default function Landing() {
  return (
    <div className="min-h-screen dark:bg-zinc-950 dark:text-white bg-slate-50 text-slate-800">
      <Navigation />
      <main>
        <Hero />
        <TurnSiteMessages />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <SectionBlog />
        <div id="contact">
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </div>
  );
}
