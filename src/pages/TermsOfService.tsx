import { Layout } from "@/components/Layout";
import { FileText } from "lucide-react";

export default function TermsOfService() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: December 11, 2024</p>
          </div>

          {/* Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Agreement to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using DuoDrive's services, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services. We reserve the right 
                to modify these terms at any time, and your continued use constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Description of Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                DuoDrive provides a car deal analysis platform that helps users evaluate vehicle purchase 
                offers. Our services include the DuoDrive Score calculation, AI-powered deal assistance, 
                and optional coaching sessions with car-buying experts. Our goal is to help you make 
                informed decisions about your car purchases.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To access certain features, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Use our services for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Interfere with or disrupt the integrity of our services</li>
                <li>Upload malicious code or harmful content</li>
                <li>Impersonate others or provide false information</li>
                <li>Use automated systems to access our services without permission</li>
                <li>Resell or redistribute our services without authorization</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Deal Analysis Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                The DuoDrive Score and deal analysis are provided for informational purposes only and 
                should not be considered as financial, legal, or professional advice. While we strive 
                for accuracy, market conditions, dealer pricing, and financing terms can vary. You are 
                solely responsible for your purchasing decisions. We recommend consulting with qualified 
                professionals before making significant financial commitments.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Coaching Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Coaching sessions are subject to availability and scheduling. Coaches provide guidance 
                based on their expertise, but their advice does not constitute professional financial 
                or legal counsel. Session fees are charged according to the tier selected and are 
                subject to our refund policy. We reserve the right to modify coaching offerings and pricing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                All content, features, and functionality of DuoDrive—including but not limited to text, 
                graphics, logos, algorithms, and software—are owned by DuoDrive and protected by 
                intellectual property laws. You may not copy, modify, distribute, or create derivative 
                works without our express written consent.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">User Content</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of content you submit to DuoDrive (such as deal information and 
                messages). By submitting content, you grant us a non-exclusive, worldwide license to 
                use, process, and analyze this content to provide and improve our services. You represent 
                that you have the right to share any content you submit.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by law, DuoDrive shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of our 
                services. Our total liability shall not exceed the amount you paid to us in the twelve 
                months preceding the claim. Some jurisdictions do not allow these limitations, so they 
                may not apply to you.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Indemnification</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree to indemnify and hold harmless DuoDrive, its officers, directors, employees, 
                and agents from any claims, damages, losses, or expenses arising from your use of our 
                services, violation of these terms, or infringement of any third-party rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate your access to our services at any time, with or without 
                cause, and with or without notice. Upon termination, your right to use our services 
                ceases immediately. You may also terminate your account at any time through your 
                account settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the 
                United States, without regard to conflict of law principles. Any disputes shall be 
                resolved in the courts of competent jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Severability</h2>
              <p className="text-muted-foreground leading-relaxed">
                If any provision of these Terms is found to be unenforceable, the remaining provisions 
                will continue in full force and effect. The unenforceable provision will be modified 
                to the minimum extent necessary to make it enforceable.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at{" "}
                <a href="mailto:contact@duodrive.app" className="text-primary hover:underline">
                  contact@duodrive.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
