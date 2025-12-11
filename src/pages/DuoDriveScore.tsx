import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { PillarCard } from "@/components/PillarCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TrendingDown, Wrench, Shield, DollarSign, Heart, ArrowRight } from "lucide-react";

const pillars = [
  {
    icon: TrendingDown,
    title: "Depreciation",
    description: "Measures how well the car holds its value over time. Lower depreciation means better resale value.",
    formula: "Depreciation Score = 100 - (Annual Depreciation Rate × Adjustment Factor)",
    details: "We analyze historical data, brand reputation, and market trends to predict how much value the car will lose each year.",
  },
  {
    icon: Wrench,
    title: "Reliability",
    description: "Evaluates the likelihood of mechanical issues based on brand and model history.",
    formula: "Reliability Score = Base Score + (Brand Factor × Model Adjustment)",
    details: "Sourced from industry reports, consumer reviews, and repair frequency data to give you a clear picture of expected maintenance.",
  },
  {
    icon: Shield,
    title: "Safety",
    description: "Assesses crash test ratings, safety features, and overall protection level.",
    formula: "Safety Score = (Crash Rating × 0.5) + (Features Score × 0.3) + (Tech Score × 0.2)",
    details: "Combines NHTSA and IIHS ratings with available safety technology like automatic braking, blind spot monitoring, and more.",
  },
  {
    icon: DollarSign,
    title: "Deal Health",
    description: "Compares the asking price to fair market value and identifies hidden fees.",
    formula: "Deal Score = 100 - |Price Deviation| - Fee Penalty",
    details: "We compare your price against thousands of similar transactions and flag any dealer add-ons or excessive fees.",
  },
  {
    icon: Heart,
    title: "Affordability",
    description: "Determines if the car fits your budget considering income, insurance, and total cost of ownership.",
    formula: "Affordability = 100 × (1 - Monthly Burden / Max Recommended)",
    details: "Based on the 20/4/10 rule: 20% down, 4-year loan, 10% of income for total car costs including insurance and maintenance.",
  },
];

const scoreRanges = [
  { range: "80-100", label: "Excellent", color: "bg-score-excellent", description: "Great deal! Low risk, high value." },
  { range: "60-79", label: "Good/Fair", color: "bg-score-good", description: "Solid choice with minor considerations." },
  { range: "40-59", label: "Caution", color: "bg-score-caution", description: "Review carefully before committing." },
  { range: "0-39", label: "Risky", color: "bg-score-risky", description: "Significant concerns identified." },
];

export default function DuoDriveScore() {
  const [selectedPillar, setSelectedPillar] = useState<typeof pillars[0] | null>(null);

  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              The DuoDrive Score
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              A transparent, data-driven score from 0-100 that helps you understand if a car deal is right for you. No hidden factors, no mystery math — just honest analysis.
            </p>
          </div>
        </div>
      </section>

      {/* Five Pillars */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">The Five Pillars</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Every DuoDrive Score is built on five key factors that determine if a car is a smart purchase for you.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((pillar) => (
              <PillarCard
                key={pillar.title}
                icon={pillar.icon}
                title={pillar.title}
                description={pillar.description}
                onClick={() => setSelectedPillar(pillar)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Score Range */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Score Interpretation</h2>
            <p className="mt-4 text-muted-foreground">
              Understanding what your DuoDrive Score means
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {scoreRanges.map((range, index) => (
              <div
                key={range.range}
                className="p-6 rounded-2xl bg-card border border-border shadow-card text-center animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`inline-flex h-4 w-16 rounded-full ${range.color} mb-4`} />
                <h3 className="text-2xl font-bold text-foreground">{range.range}</h3>
                <p className="text-lg font-semibold text-foreground mt-1">{range.label}</p>
                <p className="text-sm text-muted-foreground mt-2">{range.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground">
              Why We Built This Score
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Car buying has been opaque for too long. Dealers have all the information while buyers are left guessing. The DuoDrive Score changes that by giving you the same level of insight that professionals have — presented in a way that actually makes sense.
            </p>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              We believe transportation shouldn't break the bank, and you deserve to know exactly what you're getting into before signing anything.
            </p>
            <Button asChild className="mt-8">
              <Link to="/deal-room">
                Try It Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Formula Modal */}
      <Dialog open={!!selectedPillar} onOpenChange={() => setSelectedPillar(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedPillar && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <selectedPillar.icon className="h-5 w-5" />
                  </div>
                  {selectedPillar.title}
                </>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Formula</h4>
                  <code className="block p-3 rounded-lg bg-muted text-sm font-mono text-muted-foreground">
                    {selectedPillar?.formula}
                  </code>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">How It Works</h4>
                  <p className="text-sm text-muted-foreground">{selectedPillar?.details}</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
