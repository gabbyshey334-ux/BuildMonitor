import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#00bcd4]/10 rounded-xl flex items-center justify-center border border-[#00bcd4]/20 overflow-hidden shrink-0">
              <img src="/favicon.png" alt="" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-xl font-bold text-foreground">JengaTrack</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm mt-1">Last updated: March 2026</p>
        </header>

        <main className="space-y-6">
          {/* 1. Introduction & Who We Are */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction & Who We Are</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              JengaTrack is a WhatsApp-powered construction project management platform operated in Uganda. This Privacy Policy explains how we collect, use, store, and protect your information when you use our service.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              We collect the following types of information:
            </p>
            <ul className="text-muted-foreground text-sm leading-relaxed list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Account data:</strong> name, email address, WhatsApp number</li>
              <li><strong className="text-foreground">Project data:</strong> budgets, expenses, materials, worker logs, and related construction data</li>
              <li><strong className="text-foreground">WhatsApp messages</strong> sent to the bot</li>
              <li><strong className="text-foreground">Photos and receipts</strong> you send (e.g. for expense or material tracking)</li>
              <li><strong className="text-foreground">Voice notes</strong> sent via WhatsApp</li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              We use your information to:
            </p>
            <ul className="text-muted-foreground text-sm leading-relaxed list-disc list-inside space-y-1">
              <li>Provide and operate the JengaTrack service</li>
              <li>Process your messages with AI to extract structured data (expenses, materials, worker counts, etc.)</li>
              <li>Send WhatsApp responses via Twilio</li>
              <li>Improve and develop the platform</li>
            </ul>
          </section>

          {/* 4. Data Storage & Security */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Data Storage & Security</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your data is stored on Supabase (PostgreSQL) with row-level security. Data is encrypted at rest and in transit. Only the account owner can access their project data; we do not share your data with third parties for their marketing or other purposes beyond what is necessary to operate the service.
            </p>
          </section>

          {/* 5. Third Party Services */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Third Party Services</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              We use the following third party services:
            </p>
            <ul className="text-muted-foreground text-sm leading-relaxed list-disc list-inside space-y-1">
              <li><strong className="text-foreground">Twilio</strong> — WhatsApp messaging</li>
              <li><strong className="text-foreground">OpenAI</strong> — AI features</li>
              <li><strong className="text-foreground">Google Gemini</strong> — AI features</li>
              <li><strong className="text-foreground">Vercel</strong> — hosting</li>
              <li><strong className="text-foreground">Supabase</strong> — database and authentication</li>
            </ul>
          </section>

          {/* 6. Data Retention */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We keep your data while your account is active. If you request account deletion, your data will be deleted within 30 days of the request.
            </p>
          </section>

          {/* 7. Your Rights */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              You have the right to access, correct, export, and delete your data. To exercise these rights or for any privacy-related questions, contact us at{" "}
              <a href="mailto:privacy@jengatrackapp.com" className="text-[#00bcd4] hover:underline">privacy@jengatrackapp.com</a>.
            </p>
          </section>

          {/* 8. WhatsApp Data */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">8. WhatsApp Data</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Messages you send to the JengaTrack WhatsApp bot are processed to extract structured data (e.g. expense amounts, material quantities). Raw message logs are not retained beyond 30 days.
            </p>
          </section>

          {/* 9. Children's Privacy */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              JengaTrack is not intended for users under 18. We do not knowingly collect personal information from children under 18.
            </p>
          </section>

          {/* 10. Changes to This Policy */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you via email of any material changes.
            </p>
          </section>

          {/* 11. Contact Us */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For privacy questions or requests:{" "}
              <a href="mailto:privacy@jengatrackapp.com" className="text-[#00bcd4] hover:underline">privacy@jengatrackapp.com</a>
            </p>
          </section>
        </main>

        {/* Back to app */}
        <footer className="mt-10 pt-6 border-t border-border text-center">
          <Link href="/projects">
            <span className="text-[#00bcd4] hover:text-[#0097a7] font-medium text-sm cursor-pointer transition-colors">
              Back to app
            </span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
