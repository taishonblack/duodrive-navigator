import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { CoachingCard } from "@/components/CoachingCard";
import { Upload, Bot, Users, ArrowRight, TrendingDown, Shield, Wrench, DollarSign, Heart } from "lucide-react";
import heroImage from "@/assets/hero-road.jpg";

const steps = [
  {
    icon: Upload,
    title: "Upload or Enter Your Quote",
    description: "Paste your deal details or upload a dealer's quote. Our AI will extract the numbers automatically.",
  },
  {
    icon: Bot,
    title: "AI + DuoDrive Score Analysis",
    description: "Get instant insights on depreciation, reliability, safety, deal health, and affordability.",
  },
  {
    icon: Users,
    title: "Talk to a Coach if Needed",
    description: "Connect with a human expert for personalized guidance on your specific deal.",
  },
];

const pillars = [
  { icon: TrendingDown, title: "Depreciation", color: "text-score-excellent" },
  { icon: Wrench, title: "Reliability", color: "text-score-good" },
  { icon: Shield, title: "Safety", color: "text-score-excellent" },
  { icon: DollarSign, title: "Deal Health", color: "text-score-caution" },
  { icon: Heart, title: "Affordability", color: "text-score-good" },
];

const coachingTiers = [
  {
    title: "Quick Text Help",
    price: 29,
    duration: "10 minutes",
    features: [
      "Text-based consultation",
      "Quick deal review",
      "Fee breakdown analysis",
      "Negotiation tips",
    ],
  },
  {
    title: "Live Phone Session",
    price: 99,
    duration: "30 minutes",
    features: [
      "Live phone consultation",
      "In-depth deal analysis",
      "Negotiation strategy",
      "Performance-based guidance",
    ],
    popular: true,
  },
  {
    title: "Full Concierge",
    price: 499,
    duration: "End-to-end support",
    features: [
      "Complete buying assistance",
      "Dealer communication",
      "Price negotiation",
      "Paperwork review",
    ],
  },
];

export default function Index() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70" />
        </div>
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="max-w-2xl animate-fade-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Buying a car should be as simple as buying a TV.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
              DuoDrive helps you understand if a car is safe, fair, affordable — and right for your budget.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="hero">
                <Link to="/deal-room">
                  Check My Deal
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="hero-secondary">
                <Link to="/score">Learn the DuoDrive Score</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              How DuoDrive Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to understand your car deal
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-soft">
                  {index + 1}
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-foreground mb-4">
                  <step.icon className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DuoDrive Score Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-up">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                The DuoDrive Score
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                A comprehensive 0-100 score that tells you everything you need to know about your car deal at a glance. Built on five key pillars that matter most to car buyers.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.title}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted"
                  >
                    <pillar.icon className={`h-4 w-4 ${pillar.color}`} />
                    <span className="text-sm font-medium text-foreground">{pillar.title}</span>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-8">
                <Link to="/score">
                  Learn More
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex justify-center animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl scale-150" />
                <div className="relative p-8 rounded-3xl bg-card border border-border shadow-elevated">
                  <ScoreRing score={78} size="xl" />
                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">Example Score</p>
                    <p className="text-lg font-semibold text-foreground">2022 Honda Accord</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coaching Tiers */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Need Human Guidance?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Our expert coaches are ready to help you navigate your car deal
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {coachingTiers.map((tier, index) => (
              <CoachingCard
                key={tier.title}
                {...tier}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="text-center mt-12">
            <Button asChild variant="outline" size="lg">
              <Link to="/coaching">
                View All Coaching Options
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-secondary p-8 md:p-12 shadow-elevated">
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
              <div className="absolute inset-0 bg-gradient-to-l from-primary to-transparent" />
            </div>
            <div className="relative max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground">
                Ready to understand your deal?
              </h2>
              <p className="mt-4 text-lg text-secondary-foreground/80">
                Start with the DuoDrive Score and get instant clarity on your next car purchase.
              </p>
              <Button asChild variant="hero" className="mt-8">
                <Link to="/deal-room">
                  Check My Deal Now
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
