import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FAQ() {
  const faqs = [
    {
      question: "Do I need to download an app?",
      answer:
        "No, just use WhatsApp. JengaTrack works entirely through WhatsApp and a web dashboard. No app downloads required.",
    },
    {
      question: "How much does it cost?",
      answer:
        "Start with a 14-day free trial (no credit card required). After that, plans start at 30,000 UGX per month for solo contractors.",
    },
    {
      question: "Can I use it in Luganda?",
      answer:
        "Yes! JengaTrack has full bilingual support. Send messages in English or Luganda - our AI understands both languages.",
    },
    {
      question: "Is my data secure?",
      answer:
        "Absolutely. We use bank-level encryption and host all data securely on Supabase. Your data is private and only accessible to you.",
    },
    {
      question: "Can I export my data?",
      answer:
        "Yes, you can export all your expenses, budgets, and reports to Excel format anytime. Your data belongs to you.",
    },
    {
      question: "How do I get started?",
      answer:
        "Sign up for free, link your WhatsApp number, and start logging expenses. It takes less than 2 minutes to set up.",
    },
    {
      question: "What if I need help?",
      answer:
        "We offer WhatsApp support, email support, and video tutorials. Our team is here to help you succeed.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes, there are no contracts or commitments. Cancel anytime from your dashboard. Your data remains accessible for 30 days after cancellation.",
    },
  ];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-border"
              >
                <AccordionTrigger className="text-left text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

