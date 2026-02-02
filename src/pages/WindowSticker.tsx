import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Copy, CheckCircle2, ArrowRight, HelpCircle, AlertTriangle, DollarSign, Tag, Truck, Settings, TrendingUp, FileText, Car, Hash, Percent, Calendar, Shield } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Mock sticker data for illustration
const MOCK_STICKER = {
  vehicle: "2026 Example Motors Falcon SUV (SEL AWD)",
  vin: "1EXAMPLEVIN0000000",
  msrp: 38900,
  options: 2100,
  destination: 1295,
  dealerAddOns: 899,
  marketAdjustment: 1500,
  sellingPrice: 44694,
  taxesFees: 3200,
  outTheDoor: 47894,
};

const CALLOUTS = [
  { number: 1, label: "Vehicle Info", description: "Year, make, model, trim.", icon: Car },
  { number: 2, label: "VIN", description: "Helps verify configuration and check recalls.", icon: Hash },
  { number: 3, label: "MSRP", description: "Suggested price, not what you automatically owe.", icon: Tag },
  { number: 4, label: "Options & Packages", description: "Real equipment that increases MSRP.", icon: Settings },
  { number: 5, label: "Destination / Freight", description: "Common, usually not removable.", icon: Truck },
  { number: 6, label: "Dealer Add-ons", description: "Often negotiable if you didn't ask for them.", icon: AlertTriangle, highlight: true },
  { number: 7, label: "Market Adjustment", description: "Pure markup; negotiable.", icon: TrendingUp, highlight: true },
  { number: 8, label: "Selling Price", description: "Price before taxes/fees.", icon: DollarSign },
  { number: 9, label: "Fees & Taxes", description: "Doc fee, registration, sales tax.", icon: Percent },
  { number: 10, label: "Out-the-Door Total", description: "The number that matters most.", icon: FileText, highlight: true },
];

const SCRIPTS = [
  {
    title: "Out-the-door request",
    script: "Can you give me the out-the-door total in writing, including all fees and taxes?",
  },
  {
    title: "Fee clarity",
    script: "Which fees are mandatory, and which are optional?",
  },
  {
    title: "Add-on removal",
    script: "Please remove any add-ons I didn't request.",
  },
  {
    title: "Offset if add-ons stay",
    script: "If the add-ons can't be removed, can you reduce the selling price to offset them?",
  },
  {
    title: "Pressure response",
    script: "I'm not deciding today. Can I have this offer in writing and 24 hours to review?",
  },
];

const GLOSSARY_ITEMS = [
  { term: "APR", definition: "the interest rate on your loan" },
  { term: "Term", definition: "number of months you repay" },
  { term: "Doc fee", definition: "dealer paperwork fee (varies; sometimes negotiable)" },
  { term: "Residual (lease)", definition: "estimated value at lease end" },
  { term: "Money factor (lease)", definition: "lease interest charge (Henry can translate it)" },
];

export default function WindowSticker() {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyScript = async (script: string, index: number) => {
    try {
      await navigator.clipboard.writeText(script);
      setCopiedIndex(index);
      toast({ title: "Copied!", description: "Script copied to clipboard" });
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy manually", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <SEO
        title="Understand the Window Sticker | DuoDrive"
        description="Learn what every line on a car window sticker means and what's negotiable. Get scripts to use at the dealership."
      />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Understand the Window Sticker
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Know what's negotiable, what's normal, and what actually matters in the deal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/deal-room">
                <Button size="lg" className="gap-2">
                  Analyze a sticker photo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                Upload a window sticker or buyer's order in the Deal Room — Henry will extract the key numbers.
              </p>
            </div>
          </div>

          {/* Mock Sticker Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-2">A window sticker, explained</h2>
            <p className="text-muted-foreground mb-8">
              Most people focus on MSRP — but the deal lives in fees, add-ons, APR, and out-the-door total.
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Mock Sticker Card */}
              <Card className="p-6 bg-card border-2 font-mono text-sm">
                <div className="space-y-3">
                  <div className="text-center border-b pb-3 mb-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mr-2">1</span>
                    <span className="font-bold text-lg">{MOCK_STICKER.vehicle}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">2</span>
                      VIN:
                    </span>
                    <span className="text-muted-foreground">{MOCK_STICKER.vin}</span>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">3</span>
                        MSRP:
                      </span>
                      <span>${MOCK_STICKER.msrp.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pl-7">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">4</span>
                        Options & Packages:
                      </span>
                      <span>${MOCK_STICKER.options.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pl-7">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">5</span>
                        Destination / Freight:
                      </span>
                      <span>${MOCK_STICKER.destination.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold mr-2">6</span>
                        Dealer Add-ons:
                      </span>
                      <span>${MOCK_STICKER.dealerAddOns.toLocaleString()} ⚠️</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 text-xs font-bold mr-2">7</span>
                        Market Adjustment:
                      </span>
                      <span>${MOCK_STICKER.marketAdjustment.toLocaleString()} ⚠️</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center font-semibold">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">8</span>
                        Selling Price:
                      </span>
                      <span>${MOCK_STICKER.sellingPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pl-7">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold mr-2">9</span>
                        Est. Taxes & Fees:
                      </span>
                      <span>${MOCK_STICKER.taxesFees.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t-2 border-primary pt-3">
                    <div className="flex justify-between items-center font-bold text-lg text-primary">
                      <span>
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold mr-2">10</span>
                        OUT-THE-DOOR TOTAL:
                      </span>
                      <span>${MOCK_STICKER.outTheDoor.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Callouts List */}
              <div className="space-y-3">
                {CALLOUTS.map((callout) => (
                  <div 
                    key={callout.number} 
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      callout.highlight 
                        ? "bg-amber-500/10 border border-amber-500/30" 
                        : "bg-muted/50"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                      callout.highlight 
                        ? "bg-amber-500 text-white" 
                        : "bg-primary text-primary-foreground"
                    }`}>
                      {callout.number}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <callout.icon className={`h-4 w-4 ${callout.highlight ? "text-amber-500" : "text-muted-foreground"}`} />
                        <span className="font-medium text-foreground">{callout.label}</span>
                        {callout.highlight && (
                          <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                            Negotiable
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{callout.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Accordion Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-6">What each line means</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="msrp">
                <AccordionTrigger>MSRP</AccordionTrigger>
                <AccordionContent>
                  MSRP is the manufacturer's suggested price. It's a reference point — not what you automatically owe.
                  The real comparison is your selling price and out-the-door total versus similar cars.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="options">
                <AccordionTrigger>Options & packages</AccordionTrigger>
                <AccordionContent>
                  These are real features (like premium audio or safety packages). They can add value, but they don't guarantee a good deal.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="destination">
                <AccordionTrigger>Destination / freight</AccordionTrigger>
                <AccordionContent>
                  A standard charge to ship the car. It's common and usually not negotiable — but you can still negotiate the selling price.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="dealer-addons">
                <AccordionTrigger>Dealer add-ons</AccordionTrigger>
                <AccordionContent>
                  These are often negotiable. If you didn't ask for them, request removal — or ask for an offsetting reduction in the selling price.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="market-adjustment">
                <AccordionTrigger>Market adjustment</AccordionTrigger>
                <AccordionContent>
                  This is markup. It's negotiable. If a dealer won't budge, shopping another dealer is sometimes the fastest win.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="otd">
                <AccordionTrigger>Selling price vs Out-the-door</AccordionTrigger>
                <AccordionContent>
                  Selling price is before taxes/fees. Out-the-door is what you actually pay.
                  Always ask for the out-the-door total in writing.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          {/* Scripts Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-2">What to say at the dealership</h2>
            <p className="text-muted-foreground mb-6">Copy these scripts and use them word-for-word.</p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCRIPTS.map((script, index) => (
                <Card key={index} className="p-4 flex flex-col">
                  <h3 className="font-medium text-foreground mb-2">{script.title}</h3>
                  <p className="text-sm text-muted-foreground flex-1 mb-3 italic">"{script.script}"</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyScript(script.script, index)}
                    className="w-full"
                  >
                    {copiedIndex === index ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </Card>
              ))}
            </div>
          </section>

          {/* Glossary Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-foreground mb-2">Quick glossary</h2>
            <Card className="p-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {GLOSSARY_ITEMS.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{item.term}:</span>{" "}
                      <span className="text-muted-foreground">{item.definition}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4 pt-4 border-t flex items-center gap-2">
                <Shield className="h-4 w-4" />
                If any term is confusing, ask Henry — he'll explain it in plain English.
              </p>
            </Card>
          </section>

          {/* Final CTA */}
          <section className="text-center py-12 bg-muted/30 rounded-2xl">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Ready to evaluate a deal?</h2>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link to="/deal-room">
                <Button size="lg" className="gap-2">
                  Go to Deal Room
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/glossary" className="text-sm text-muted-foreground hover:text-foreground underline">
                Back to learning
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
