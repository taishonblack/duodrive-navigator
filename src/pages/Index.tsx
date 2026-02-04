import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO, organizationSchema, websiteSchema } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/ScoreRing";
import { Upload, Bot, FileSearch, ArrowRight, TrendingDown, Shield, Wrench, DollarSign, Heart, MessageSquare, Target, CheckCircle2, Sparkles, Calculator, FileText } from "lucide-react";
import heroImage from "@/assets/hero-road.jpg";

const steps = [
  {
    icon: Upload,
    title: "Tell Quinn About Your Deal",
    description: "Describe your deal, paste a quote, or upload a screenshot. Quinn, your AI copilot, extracts and analyzes everything automatically.",
  },
  {
    icon: Calculator,
    title: "Get Your DuoDrive Score",
    description: "Quinn calculates your score instantly — analyzing pricing, fees, and affordability so you know if you're overpaying.",
  },
  {
    icon: MessageSquare,
    title: "Know What to Say Next",
    description: "Quinn generates negotiation scripts that are firm, polite, and dealer-ready. Just chat — no forms, no guesswork.",
  },
];

const pillars = [
  { icon: TrendingDown, title: "Depreciation", color: "text-score-excellent" },
  { icon: Wrench, title: "Reliability", color: "text-score-good" },
  { icon: Shield, title: "Safety", color: "text-score-excellent" },
  { icon: DollarSign, title: "Deal Health", color: "text-score-caution" },
  { icon: Heart, title: "Affordability", color: "text-score-good" },
];

const features = [
  {
    icon: Target,
    title: "Fair Price Range",
    description: "Quinn shows you what others are paying for the same car in your area.",
  },
  {
    icon: FileSearch,
    title: "Quote Analyzer",
    description: "Paste any dealer quote and Quinn decodes the math, flags hidden fees, and recalculates correctly.",
  },
  {
    icon: Sparkles,
    title: "Negotiation Scripts",
    description: "Quinn tells you exactly what to say to counter, remove fees, or walk away professionally.",
  },
  {
    icon: Bot,
    title: "Meet Quinn",
    description: "Your AI copilot for car buying. Just chat — Quinn handles the research, math, and strategy.",
  },
];

export default function Index() {
  return (
    <Layout>
      <SEO 
        canonical="/"
        keywords="car buying, car deal analyzer, DuoDrive Score, car affordability, vehicle purchase, AI car buying, negotiation scripts"
        structuredData={[organizationSchema, websiteSchema]}
      />
      
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
              Know the deal before you sign.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
              Meet Quinn — your AI copilot for car buying. Just describe your deal and Quinn analyzes pricing, decodes quotes, and tells you exactly what to say to the dealer.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="hero">
                <Link to="/deal-room">
                  Chat with Quinn
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="hero-secondary">
                <Link to="/score">See How It Works</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 bg-muted/50 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>No dealership ties</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>100% buyer-focused</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>AI-powered analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Instant results</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              How Quinn Helps You
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Three steps to understand your deal and know what to say
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

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Everything You Need to Buy Smart
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Tools that replace hours of research and give you dealer-level knowledge
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated hover:border-primary/20 transition-all duration-300 animate-fade-up"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
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

      {/* Quote Analyzer Highlight */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 flex justify-center animate-fade-up">
              <div className="relative max-w-md">
                <div className="p-6 rounded-2xl bg-card border border-border shadow-elevated">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Dealer Quote Uploaded</p>
                      <p className="text-sm text-muted-foreground">AI analyzing...</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">Nitrogen Tires</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">$299 (Junk Fee)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Doc Fee</span>
                      <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">$899 (Negotiable)</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Registration</span>
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">$385 (Legit)</span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-lg bg-accent">
                    <p className="text-sm font-medium text-foreground">💡 You're overpaying by ~$1,198</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Decode Any Dealer Quote
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Paste a screenshot, forward an email, or just describe the numbers. Quinn instantly identifies hidden fees, rate padding, and payment packing—then tells you exactly what to remove.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span className="text-muted-foreground">Recalculates your payment correctly</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span className="text-muted-foreground">Flags fees as legit, negotiable, or junk</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span className="text-muted-foreground">Shows how much you could save</span>
                </li>
              </ul>
              <Button asChild className="mt-8">
                <Link to="/deal-room">
                  Chat with Quinn
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
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
                Quinn is ready to help. Just describe your deal and get instant analysis.
              </p>
              <Button asChild variant="hero" className="mt-8">
                <Link to="/deal-room">
                  Chat with Quinn Now
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
