import { Layout } from "@/components/Layout";
import { CoachingCard } from "@/components/CoachingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Upload, Target, MessageCircle, Phone, Users } from "lucide-react";

const coachingTiers = [
  {
    title: "Quick Text Help",
    price: 29,
    duration: "10 minutes",
    icon: MessageCircle,
    features: [
      "Text-based consultation",
      "Quick deal review",
      "Fee breakdown analysis",
      "Negotiation tips",
      "Same-day response",
    ],
  },
  {
    title: "Live Phone Session",
    price: 99,
    duration: "30 minutes",
    icon: Phone,
    features: [
      "Live phone consultation",
      "In-depth deal analysis",
      "Personalized negotiation strategy",
      "Q&A session",
      "Follow-up summary email",
    ],
    popular: true,
  },
  {
    title: "Full Concierge",
    price: 499,
    duration: "End-to-end support",
    icon: Users,
    features: [
      "Complete buying assistance",
      "Direct dealer communication",
      "Price negotiation on your behalf",
      "Paperwork review",
      "Financing guidance",
      "Up to 2 weeks of support",
    ],
  },
];

export default function Coaching() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Expert Coaching for Your Car Deal
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Sometimes you need a real human in your corner. Our coaches are car buying experts who work exclusively for you — never the dealer.
            </p>
          </div>
        </div>
      </section>

      {/* Coaching Tiers */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {coachingTiers.map((tier, index) => (
              <div
                key={tier.title}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CoachingCard
                  title={tier.title}
                  price={tier.price}
                  duration={tier.duration}
                  features={tier.features}
                  popular={tier.popular}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">How Coaching Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center animate-fade-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">1. Choose Your Time</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a coaching tier and pick a time that works for you.
              </p>
            </div>
            <div className="text-center animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">2. Share Your Deal</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your quote and share any concerns or questions.
              </p>
            </div>
            <div className="text-center animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Target className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">3. Get Expert Help</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect with your coach and get personalized guidance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            <div className="p-8 rounded-2xl bg-card border border-border shadow-elevated">
              <h2 className="text-2xl font-semibold text-foreground text-center mb-6">
                Book a Session
              </h2>
              <form className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input id="name" placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Coaching Tier</Label>
                  <select
                    id="tier"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="quick">Quick Text Help - $29</option>
                    <option value="live">Live Phone Session - $99</option>
                    <option value="concierge">Full Concierge - $499</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">What do you need help with?</Label>
                  <Textarea
                    id="goals"
                    placeholder="Tell us about your deal and what questions you have..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upload Documents (optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Continue to Booking
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            100% Buyer-Focused
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our coaches are compensated based on your satisfaction, not commissions. They have one goal: helping you get the best possible deal. No upsells, no pressure — just honest advice.
          </p>
        </div>
      </section>
    </Layout>
  );
}
