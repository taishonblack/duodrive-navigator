import { Layout } from "@/components/Layout";
import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: December 11, 2024</p>
          </div>

          {/* Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                DuoDrive ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our 
                car deal analysis platform and related services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Account information (email address, password)</li>
                <li>Profile information (name, profile photo)</li>
                <li>Deal information (vehicle details, pricing, financing terms)</li>
                <li>Communication data (messages with our AI Copilot, coaching sessions)</li>
                <li>Contact information when you reach out to us</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide, maintain, and improve our services</li>
                <li>Calculate your DuoDrive Score and provide deal analysis</li>
                <li>Facilitate coaching sessions and AI-powered assistance</li>
                <li>Send you updates, security alerts, and support messages</li>
                <li>Respond to your comments, questions, and requests</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information Sharing</h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell your personal information. We may share your information only in the 
                following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>With your consent or at your direction</li>
                <li>With coaches you choose to connect with for coaching sessions</li>
                <li>With service providers who assist in our operations</li>
                <li>To comply with legal obligations or protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal 
                information against unauthorized access, alteration, disclosure, or destruction. This 
                includes encryption, secure servers, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide 
                you services. You can request deletion of your account and associated data at any time 
                through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Depending on your location, you may have certain rights regarding your personal information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Access and receive a copy of your data</li>
                <li>Correct inaccurate or incomplete information</li>
                <li>Delete your personal information</li>
                <li>Object to or restrict certain processing</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Cookies and Tracking</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
                and personalize content. You can control cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our services are not directed to children under 18. We do not knowingly collect personal 
                information from children. If you believe we have collected information from a child, 
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes 
                by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{" "}
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
