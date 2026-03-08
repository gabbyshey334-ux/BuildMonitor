"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  HelpCircle,
  Search,
  Plus,
  Zap,
  Phone,
  LayoutDashboard,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const WHATSAPP_JOIN = "+1 415 523 8886";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_JOIN.replace(/\s/g, "")}`;

const COMMAND_CATEGORIES = [
  {
    name: "Expenses",
    color: "bg-[#00bcd4]/10 text-[#00bcd4] border-[#00bcd4]/20",
    examples: [
      { text: "Bought 50 bags cement for 1,900,000", desc: "Log expense" },
      { text: "Paid 50k for transport", desc: "Log expense" },
    ],
  },
  {
    name: "Materials",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    examples: [
      { text: "Used 5 bags cement", desc: "Update inventory" },
      { text: "Received 1000 bricks", desc: "Add inventory" },
    ],
  },
  {
    name: "Workers",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    examples: [
      { text: "6 workers on site today", desc: "Log daily attendance" },
    ],
  },
  {
    name: "Progress",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    examples: [
      { text: "Foundation 80% complete", desc: "Update progress" },
      { text: "Heavy rain, no work", desc: "Log daily notes" },
    ],
  },
  {
    name: "Budget",
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    examples: [
      { text: "How much have we spent?", desc: "Check budget status" },
    ],
  },
  {
    name: "Queries",
    color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    examples: [
      { text: "How much cement left?", desc: "Check inventory" },
      { text: "Switch project", desc: "Change active project" },
    ],
  },
];

const FAQS = [
  {
    question: "How do I link my WhatsApp to my dashboard?",
    answer:
      "Go to the Settings page and enter your WhatsApp number in the Profile section. Once saved, any messages you send from that number will be linked to your account.",
  },
  {
    question: "What languages does the bot support?",
    answer:
      "The bot fully supports English and Luganda. It also has partial support for Swahili. You can mix languages in your messages (e.g., 'Bought cement 50k').",
  },
  {
    question: "Can I have multiple projects?",
    answer:
      "Yes! You can create unlimited projects. When you send a message, if you have multiple active projects, the bot may ask you to confirm which project you are updating, or you can say 'Switch project' to change your active context.",
  },
  {
    question: "How do I scan a receipt?",
    answer:
      "Simply take a photo of the receipt and send it to the WhatsApp bot. Our system will automatically scan it (OCR) to extract the date, items, and total amount.",
  },
  {
    question: "What happens if the bot doesn't understand me?",
    answer:
      "The bot will ask clarifying questions if a message is unclear. You can also type 'help' at any time to see a list of what it can do.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. All your data is stored in a secure database with strict row-level security. Only you (and team members you explicitly invite) can access your project data.",
  },
  {
    question: "How do I reset my password?",
    answer:
      "If you've forgotten your password, go to the Login page and click 'Forgot Password'. Enter your email address to receive a secure reset link.",
  },
];

function FaqItem({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden transition-all duration-200">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold text-foreground">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      <div
        className={cn(
          "px-4 text-muted-foreground text-sm overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-40 pb-4 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {answer}
      </div>
    </div>
  );
}

export default function HelpPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-12 pb-12">
        {/* 1. Hero Section */}
        <div className="relative rounded-2xl bg-card border border-border p-8 md:p-12 overflow-hidden text-center">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00bcd4] rounded-full blur-[120px] opacity-[0.08] pointer-events-none" />
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">🧱</span>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Help Center</h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-lg mb-8">
              Everything you need to get the most out of JengaTrack.
            </p>
            
            <div className="relative w-full max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-[#00bcd4] transition-colors" />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 rounded-2xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#00bcd4]/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* 2. Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-6 rounded-xl bg-card border border-border hover:border-[#00bcd4]/30 hover:shadow-[0_0_20px_rgba(0,188,212,0.1)] transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mb-4 group-hover:bg-[#00bcd4] transition-colors">
              <MessageCircle className="w-6 h-6 text-[#00bcd4] group-hover:text-black transition-colors" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">WhatsApp Bot</h3>
            <p className="text-muted-foreground text-sm mb-3">Start chatting instantly</p>
            <span className="text-[#00bcd4] text-xs font-bold uppercase tracking-wider group-hover:underline">
              Open Chat &rarr;
            </span>
          </a>

          <a
            href="/projects"
            className="group block p-6 rounded-xl bg-card border border-border hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500 transition-colors">
              <LayoutDashboard className="w-6 h-6 text-emerald-500 group-hover:text-black transition-colors" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">View Dashboard</h3>
            <p className="text-muted-foreground text-sm mb-3">Go to your project</p>
            <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider group-hover:underline">
              Go now &rarr;
            </span>
          </a>

          <a
            href="mailto:support@jengatrack.com"
            className="group block p-6 rounded-xl bg-card border border-border hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors">
              <Mail className="w-6 h-6 text-purple-500 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Send Feedback</h3>
            <p className="text-muted-foreground text-sm mb-3">Report a bug or suggestion</p>
            <span className="text-purple-500 text-xs font-bold uppercase tracking-wider group-hover:underline">
              Email us &rarr;
            </span>
          </a>
        </div>

        {/* 3. Getting Started */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Get Started in 3 Steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Plus,
                title: "Create your project",
                desc: "Sign up and create your first construction project with budget and location.",
                step: "01",
              },
              {
                icon: Phone,
                title: "Connect WhatsApp",
                desc: "Save our WhatsApp number and send your first message to link your account.",
                step: "02",
              },
              {
                icon: Zap,
                title: "Start logging",
                desc: "Send expenses, materials, worker counts and photos directly from WhatsApp.",
                step: "03",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="relative p-6 rounded-xl bg-card border border-border hover:border-[#00bcd4]/20 transition-all group overflow-hidden"
              >
                <div className="absolute top-2 right-4 text-6xl font-black text-foreground/[0.03] select-none pointer-events-none group-hover:text-foreground/[0.06] transition-colors">
                  {step.step}
                </div>
                <div className="w-12 h-12 rounded-full bg-[#00bcd4]/10 flex items-center justify-center mb-4 text-[#00bcd4]">
                  <step.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4. WhatsApp Commands */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">WhatsApp Commands</h2>
          <p className="text-muted-foreground mb-6">Just type naturally — here are some examples:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COMMAND_CATEGORIES.map((cat) => (
              <div key={cat.name} className="p-5 rounded-xl bg-card border border-border">
                <span className={cn("px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider mb-4 inline-block", cat.color)}>
                  {cat.name}
                </span>
                <div className="space-y-4">
                  {cat.examples.map((ex, i) => (
                    <div key={i}>
                      <div className="bg-muted text-foreground/90 px-3 py-2 rounded-lg rounded-tl-none inline-block text-sm mb-1 max-w-[90%]">
                        {ex.text}
                      </div>
                      <p className="text-[#00bcd4]/70 text-xs ml-1">{ex.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. FAQ */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, i) => (
                <FaqItem
                  key={i}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaqIndex === i}
                  onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                />
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">No results found for "{searchQuery}"</p>
            )}
          </div>
        </div>

        {/* 6. Footer Support */}
        <div className="p-[1px] rounded-2xl bg-gradient-to-r from-[#00bcd4] to-purple-600">
          <div className="bg-card rounded-[15px] p-8 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Still need help?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Our team is available via WhatsApp during East Africa business hours.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                className="bg-[#00bcd4] hover:bg-[#0097a7] text-black font-bold h-12 px-8 rounded-xl"
              >
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Chat on WhatsApp
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 h-12 px-8 rounded-xl"
                asChild
              >
                <a href="mailto:support@jengatrack.com">
                  <Mail className="w-5 h-5 mr-2" />
                  Email Support
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs mt-4">Average response time: under 2 hours</p>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
