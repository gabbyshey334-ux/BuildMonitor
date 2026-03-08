import { Link } from "wouter";

export default function Terms() {
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Terms & Conditions</h1>
          <p className="text-muted-foreground text-sm mt-1">Last updated: March 2026</p>
        </header>

        <main className="space-y-6">
          {/* 1. Acceptance of Terms */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              By accessing or using JengaTrack, you agree to be bound by these Terms & Conditions. If you do not agree, do not use the service.
            </p>
          </section>

          {/* 2. Description of Service */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              JengaTrack is a WhatsApp-based construction project tracking platform. The service includes:
            </p>
            <ul className="text-muted-foreground text-sm leading-relaxed list-disc list-inside space-y-1">
              <li>Expense logging</li>
              <li>Materials management</li>
              <li>Daily accountability (worker logs, progress notes)</li>
              <li>Budget analytics</li>
              <li>AI-powered message parsing to extract structured data from your WhatsApp messages</li>
            </ul>
          </section>

          {/* 3. Account Registration & Responsibilities */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Account Registration & Responsibilities</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You must provide accurate information when registering. You are responsible for maintaining the security of your account and for all activity that occurs under your account. Notify us promptly of any unauthorized use.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-3">
              You agree to use JengaTrack only for construction project management purposes. You must not:
            </p>
            <ul className="text-muted-foreground text-sm leading-relaxed list-disc list-inside space-y-1">
              <li>Use automated systems to abuse the WhatsApp bot</li>
              <li>Upload or transmit illegal, harmful, or offensive content</li>
              <li>Use the service for any purpose other than its intended use</li>
            </ul>
          </section>

          {/* 5. Beta Service */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Beta Service</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              JengaTrack is currently in beta. Features may change, and the service is provided &quot;as is&quot; during the beta period. We may add, modify, or discontinue features with reasonable notice where practicable.
            </p>
          </section>

          {/* 6. Subscription & Payments */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Subscription & Payments</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The service is free during the beta period. If we introduce paid plans in the future, we will communicate pricing with at least 30 days&apos; notice before any billing begins.
            </p>
          </section>

          {/* 7. Data & Privacy */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Data & Privacy</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              How we collect, use, and protect your data is governed by our{" "}
              <Link href="/privacy" className="text-[#00bcd4] hover:underline">Privacy Policy</Link>. By using JengaTrack, you also agree to that policy.
            </p>
          </section>

          {/* 8. AI-Generated Content */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">8. AI-Generated Content</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              AI features are provided for convenience. Outputs may not be 100% accurate. JengaTrack is not liable for decisions you make based on AI-generated analysis. You are responsible for verifying important data.
            </p>
          </section>

          {/* 9. Intellectual Property */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Intellectual Property</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The JengaTrack platform, branding, and software are owned by JengaTrack. You retain ownership of your project data. By using the service, you grant us the rights necessary to operate the service (e.g. storing and processing your data).
            </p>
          </section>

          {/* 10. Disclaimer of Warranties */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or fit for a particular purpose.
            </p>
          </section>

          {/* 11. Limitation of Liability */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To the fullest extent permitted by law, JengaTrack is not liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or use, arising from your use of the service.
            </p>
          </section>

          {/* 12. Termination */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Termination</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              JengaTrack may suspend or terminate accounts that violate these terms. You may delete your account at any time via Settings. Upon termination, your right to use the service ceases immediately.
            </p>
          </section>

          {/* 13. Governing Law */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Governing Law</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              These terms are governed by the laws of Uganda. Any disputes shall be subject to the exclusive jurisdiction of the courts of Uganda.
            </p>
          </section>

          {/* 14. Changes to Terms */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Changes to Terms</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We may update these terms from time to time. Material changes will be communicated via email with at least 14 days&apos; notice. Continued use after the effective date constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* 15. Contact */}
          <section className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Contact</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              For legal or terms-related questions:{" "}
              <a href="mailto:legal@jengatrackapp.com" className="text-[#00bcd4] hover:underline">legal@jengatrackapp.com</a>
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
