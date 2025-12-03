import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Shield, Eye, Heart, Users, ArrowRight, Check } from "lucide-react";

const values = [
  {
    icon: Shield,
    title: "Protection First",
    description: "We exist to protect car buyers from unfair deals, hidden fees, and financial strain. Your interests always come first.",
  },
  {
    icon: Eye,
    title: "Full Transparency",
    description: "No mystery formulas or hidden factors. Every score component is explained, every calculation is shown.",
  },
  {
    icon: Heart,
    title: "Financial Wellness",
    description: "Transportation shouldn't break the bank. We help ensure your car fits your budget, not the other way around.",
  },
  {
    icon: Users,
    title: "On Your Side",
    description: "We don't work with dealerships or take commissions. DuoDrive only works for you — the buyer.",
  },
];

const principles = [
  "Car buying should be as simple as buying a TV",
  "No hidden fees, no pressure tactics",
  "You shouldn't go broke for transportation",
  "Information should be equally accessible to everyone",
  "Honest scoring with transparent formulas",
  "Expert help available when you need it",
];

export default function WhyDuoDrive() {
  return (
    <Layout>
      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              We Built DuoDrive to Protect Car Buyers
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              For too long, car buying has been a game where dealers hold all the cards. Information asymmetry, hidden fees, and high-pressure tactics have made it one of the most stressful purchases people make. We're here to change that.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Our Values</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {values.map((value, index) => (
              <div
                key={value.title}
                className="p-6 rounded-2xl bg-card border border-border shadow-card animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground mb-4">
                  <value.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{value.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-8">
              What We Believe
            </h2>
            <div className="space-y-4">
              {principles.map((principle, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border shadow-card animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-foreground font-medium">{principle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-8">
              The Problem We're Solving
            </h2>
            <div className="prose prose-lg text-muted-foreground">
              <p className="text-lg leading-relaxed">
                Buying a car should be exciting, not terrifying. Yet for most people, it's one of the most stressful financial decisions they'll make. Why? Because the system is designed to favor those with inside knowledge.
              </p>
              <p className="text-lg leading-relaxed mt-4">
                Dealers know exactly what a car is worth, what fees are negotiable, and what financing rates are available. Buyers are left to guess, often paying thousands more than they should.
              </p>
              <p className="text-lg leading-relaxed mt-4">
                DuoDrive changes this dynamic. We give you the same information that professionals have — packaged in a way that actually makes sense. Our DuoDrive Score analyzes every aspect of a deal so you can make decisions with confidence.
              </p>
              <p className="text-lg leading-relaxed mt-4">
                We don't sell cars. We don't take commissions from dealers. We work exclusively for you, the buyer. That's the DuoDrive promise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Ready to Take Control?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Start with the DuoDrive Score and see how your deal stacks up.
          </p>
          <Button asChild variant="hero" className="mt-8">
            <Link to="/deal-room">
              Check My Deal
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
