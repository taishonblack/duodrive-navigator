import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ScoreRing } from "@/components/ScoreRing";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  ArrowLeft,
  X,
  TrendingDown,
  Wrench,
  Shield,
  DollarSign,
  Heart,
  Car,
  Calendar,
  Gauge,
  FileText,
  Plus,
  Trophy,
  Scale,
  Wallet,
  Fuel,
  ShieldCheck,
  Calculator,
  Download,
  MessageSquare,
  Sparkles,
  Target,
  PiggyBank
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { User } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Deal {
  id: string;
  name: string;
  year: string | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: string | null;
  asking_price: string | null;
  negotiated_price: string | null;
  down_payment: string | null;
  apr: string | null;
  term: string | null;
  insurance: string | null;
  fuel_cost: string | null;
  maintenance: string | null;
  registration: string | null;
  score_result: {
    overallScore?: number;
    pillarScores?: {
      depreciation?: number;
      reliability?: number;
      safety?: number;
      dealHealth?: number;
      affordability?: number;
    };
  } | null;
  created_at: string;
}

const pillarConfig = [
  { key: "depreciation", label: "Depreciation", icon: TrendingDown },
  { key: "reliability", label: "Reliability", icon: Wrench },
  { key: "safety", label: "Safety", icon: Shield },
  { key: "dealHealth", label: "Deal Health", icon: DollarSign },
  { key: "affordability", label: "Affordability", icon: Heart },
];

// Calculate monthly car payment using standard amortization formula
const calculateMonthlyPayment = (deal: Deal): number | null => {
  const price = deal.negotiated_price || deal.asking_price;
  if (!price) return null;
  
  const principal = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
  const downPayment = deal.down_payment ? parseFloat(deal.down_payment.replace(/[^0-9.]/g, "")) || 0 : 0;
  const apr = deal.apr ? parseFloat(deal.apr.replace(/[^0-9.]/g, "")) || 0 : 6; // Default 6% APR
  const termMonths = deal.term ? parseInt(deal.term.replace(/[^0-9]/g, "")) || 60 : 60; // Default 60 months
  
  const loanAmount = principal - downPayment;
  if (loanAmount <= 0) return 0;
  
  const monthlyRate = apr / 100 / 12;
  
  if (monthlyRate === 0) {
    return loanAmount / termMonths;
  }
  
  const payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                  (Math.pow(1 + monthlyRate, termMonths) - 1);
  
  return Math.round(payment);
};

// Calculate total monthly cost of ownership
const calculateTotalMonthlyCost = (deal: Deal): { payment: number; insurance: number; fuel: number; maintenance: number; registration: number; total: number } | null => {
  const payment = calculateMonthlyPayment(deal);
  if (payment === null) return null;
  
  const insurance = deal.insurance ? parseFloat(deal.insurance.replace(/[^0-9.]/g, "")) || 0 : 0;
  const fuel = deal.fuel_cost ? parseFloat(deal.fuel_cost.replace(/[^0-9.]/g, "")) || 0 : 0;
  const maintenance = deal.maintenance ? parseFloat(deal.maintenance.replace(/[^0-9.]/g, "")) || 0 : 0;
  const registration = deal.registration ? parseFloat(deal.registration.replace(/[^0-9.]/g, "")) || 0 : 0;
  
  // Convert annual registration to monthly
  const monthlyRegistration = registration / 12;
  
  const total = payment + insurance + fuel + maintenance + monthlyRegistration;
  
  return {
    payment,
    insurance,
    fuel,
    maintenance,
    registration: monthlyRegistration,
    total: Math.round(total)
  };
};

const getScoreColor = (score: number | undefined) => {
  if (!score) return "text-muted-foreground";
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-caution";
  return "text-score-risky";
};

const getScoreBg = (score: number | undefined) => {
  if (!score) return "bg-muted";
  if (score >= 80) return "bg-score-excellent/10";
  if (score >= 60) return "bg-score-good/10";
  if (score >= 40) return "bg-score-caution/10";
  return "bg-score-risky/10";
};

const formatPrice = (price: string | null) => {
  if (!price) return "—";
  const num = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return price;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
};

const formatNumber = (value: string | null) => {
  if (!value) return "—";
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US").format(num);
};

export default function DealComparison() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dealNotes, setDealNotes] = useState<Record<string, string>>({});
  const comparisonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem("duodrive-comparison-notes");
    if (savedNotes) {
      try {
        setDealNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("Failed to parse saved notes");
      }
    }
  }, []);

  // Save notes to localStorage when they change
  useEffect(() => {
    if (Object.keys(dealNotes).length > 0) {
      localStorage.setItem("duodrive-comparison-notes", JSON.stringify(dealNotes));
    }
  }, [dealNotes]);

  const updateNote = (dealId: string, note: string) => {
    setDealNotes(prev => ({
      ...prev,
      [dealId]: note
    }));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadDeals(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadDeals = async (userId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, year, make, model, trim, mileage, asking_price, negotiated_price, down_payment, apr, term, insurance, fuel_cost, maintenance, registration, score_result, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data as Deal[] || []);
    } catch (error) {
      console.error("Error loading deals:", error);
      toast({
        title: "Error",
        description: "Failed to load deals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDealSelection = (dealId: string) => {
    setSelectedDeals(prev => {
      if (prev.includes(dealId)) {
        return prev.filter(id => id !== dealId);
      }
      if (prev.length >= 4) {
        toast({
          title: "Maximum Reached",
          description: "You can compare up to 4 deals at a time.",
        });
        return prev;
      }
      return [...prev, dealId];
    });
  };

  const removeDeal = (dealId: string) => {
    setSelectedDeals(prev => prev.filter(id => id !== dealId));
  };

  const exportToPDF = async () => {
    if (!comparisonRef.current || comparedDeals.length === 0) return;
    
    setIsExporting(true);
    toast({
      title: "Generating PDF",
      description: "Please wait while we prepare your comparison...",
    });

    try {
      const element = comparisonRef.current;
      
      // Temporarily expand scroll area for full capture
      const scrollArea = element.querySelector('[data-radix-scroll-area-viewport]');
      const originalOverflow = scrollArea ? (scrollArea as HTMLElement).style.overflow : '';
      if (scrollArea) {
        (scrollArea as HTMLElement).style.overflow = 'visible';
      }
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });
      
      // Restore scroll area
      if (scrollArea) {
        (scrollArea as HTMLElement).style.overflow = originalOverflow;
      }

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      
      // Add header
      pdf.setFontSize(20);
      pdf.setTextColor(33, 33, 33);
      pdf.text('DuoDrive Deal Comparison', pdfWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, pdfWidth / 2, 22, { align: 'center' });
      
      // Calculate image dimensions to fit on page
      const availableHeight = pdfHeight - 35; // Account for header
      const scaledWidth = imgWidth * ratio * 0.9;
      const scaledHeight = imgHeight * ratio * 0.9;
      
      // Add image - if too tall, scale to fit width and add multiple pages
      const pageContentHeight = availableHeight;
      const totalPages = Math.ceil(scaledHeight / pageContentHeight);
      
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }
        
        // For single page or last page, just add the image scaled to fit
        if (totalPages === 1) {
          pdf.addImage(imgData, 'PNG', (pdfWidth - scaledWidth) / 2, 30, scaledWidth, scaledHeight);
        } else {
          // For multi-page, we need to scale differently
          const fitRatio = pdfWidth / imgWidth * 0.9;
          const fitWidth = imgWidth * fitRatio;
          const fitHeight = imgHeight * fitRatio;
          pdf.addImage(imgData, 'PNG', (pdfWidth - fitWidth) / 2, page === 0 ? 30 : 10, fitWidth, fitHeight);
          break; // Just use single scaled image
        }
      }
      
      // Generate filename
      const dealNames = comparedDeals.map(d => d.name).join(' vs ');
      const filename = `DuoDrive-Comparison-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      
      pdf.save(filename);
      
      toast({
        title: "PDF Downloaded",
        description: "Your deal comparison has been saved.",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const comparedDeals = deals.filter(d => selectedDeals.includes(d.id));

  // Find the best score for highlighting
  const bestOverallScore = Math.max(
    ...comparedDeals.map(d => d.score_result?.overallScore || 0)
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO 
        title="Compare Deals"
        description="Compare up to 4 car deals side-by-side. See DuoDrive scores, monthly costs, and 5-year projections to find the best deal."
        canonical="/compare"
        noIndex
      />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4 -ml-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center gap-3">
                <Scale className="h-8 w-8 text-primary" />
                Compare Deals
              </h1>
              <p className="text-muted-foreground mt-2">
                Select up to 4 deals to compare side-by-side
              </p>
            </div>
            <div className="flex gap-2">
              {comparedDeals.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={exportToPDF}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export PDF
                </Button>
              )}
              <Button onClick={() => setShowSelector(!showSelector)}>
                <Plus className="h-4 w-4 mr-2" />
                {showSelector ? "Hide Selection" : "Select Deals"}
              </Button>
            </div>
          </div>
        </div>

        {/* Deal Selector */}
        {showSelector && (
          <Card className="mb-8 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg">Select Deals to Compare</CardTitle>
              <CardDescription>
                {selectedDeals.length}/4 deals selected
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deals.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {deals.map(deal => (
                    <div
                      key={deal.id}
                      onClick={() => toggleDealSelection(deal.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedDeals.includes(deal.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={selectedDeals.includes(deal.id)}
                        onCheckedChange={() => toggleDealSelection(deal.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{deal.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "No vehicle info"}
                        </p>
                      </div>
                      {deal.score_result?.overallScore && (
                        <span className={`text-sm font-bold ${getScoreColor(deal.score_result.overallScore)}`}>
                          {deal.score_result.overallScore}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">No saved deals yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/deal-room">Create Your First Deal</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparison View */}
        {comparedDeals.length > 0 ? (
          <div className="space-y-6">
            {/* Selected Deals Pills - Outside PDF area */}
            <div className="flex flex-wrap gap-2 print:hidden">
              {comparedDeals.map(deal => (
                <Badge key={deal.id} variant="secondary" className="pl-3 pr-1 py-1.5 text-sm">
                  {deal.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 ml-2 hover:bg-destructive/20"
                    onClick={() => removeDeal(deal.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            {/* PDF Export Content */}
            <div ref={comparisonRef} className="bg-background p-4 rounded-lg">
              {/* Recommendation Summary */}
              {comparedDeals.length >= 2 && (
                <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Recommendation Summary
                    </CardTitle>
                    <CardDescription>Best deals based on your priorities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Best Overall Score */}
                      {(() => {
                        const bestScoreDeal = comparedDeals.reduce((best, deal) => {
                          const score = deal.score_result?.overallScore || 0;
                          const bestScore = best?.score_result?.overallScore || 0;
                          return score > bestScore ? deal : best;
                        }, comparedDeals[0]);
                        const score = bestScoreDeal?.score_result?.overallScore;
                        
                        return (
                          <div className="p-4 rounded-xl bg-background border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Trophy className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground">Best Overall</span>
                            </div>
                            <p className="font-semibold text-foreground truncate">{bestScoreDeal?.name || "—"}</p>
                            <p className={`text-2xl font-bold mt-1 ${getScoreColor(score)}`}>
                              {score || "—"} <span className="text-sm font-normal text-muted-foreground">score</span>
                            </p>
                          </div>
                        );
                      })()}

                      {/* Lowest Monthly Cost */}
                      {(() => {
                        const dealsWithCost = comparedDeals.map(deal => ({
                          deal,
                          cost: calculateTotalMonthlyCost(deal)
                        })).filter(d => d.cost && d.cost.total > 0);
                        
                        const lowestCostDeal = dealsWithCost.length > 0 
                          ? dealsWithCost.reduce((lowest, current) => 
                              current.cost!.total < lowest.cost!.total ? current : lowest
                            )
                          : null;
                        
                        return (
                          <div className="p-4 rounded-xl bg-background border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-2 rounded-lg bg-score-excellent/10">
                                <PiggyBank className="h-4 w-4 text-score-excellent" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground">Lowest Cost</span>
                            </div>
                            <p className="font-semibold text-foreground truncate">{lowestCostDeal?.deal.name || "—"}</p>
                            <p className="text-2xl font-bold mt-1 text-score-excellent">
                              {lowestCostDeal?.cost ? formatPrice(lowestCostDeal.cost.total.toString()) : "—"} 
                              <span className="text-sm font-normal text-muted-foreground">/mo</span>
                            </p>
                          </div>
                        );
                      })()}

                      {/* Best Reliability */}
                      {(() => {
                        const bestReliabilityDeal = comparedDeals.reduce((best, deal) => {
                          const score = deal.score_result?.pillarScores?.reliability || 0;
                          const bestScore = best?.score_result?.pillarScores?.reliability || 0;
                          return score > bestScore ? deal : best;
                        }, comparedDeals[0]);
                        const score = bestReliabilityDeal?.score_result?.pillarScores?.reliability;
                        
                        return (
                          <div className="p-4 rounded-xl bg-background border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-2 rounded-lg bg-score-good/10">
                                <Wrench className="h-4 w-4 text-score-good" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground">Most Reliable</span>
                            </div>
                            <p className="font-semibold text-foreground truncate">{bestReliabilityDeal?.name || "—"}</p>
                            <p className={`text-2xl font-bold mt-1 ${getScoreColor(score)}`}>
                              {score || "—"} <span className="text-sm font-normal text-muted-foreground">reliability</span>
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comparison Table */}
              <ScrollArea className="w-full">
                <div className="min-w-[600px]">
                {/* Overall Scores */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Overall DuoDrive Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                      {comparedDeals.map(deal => (
                        <div key={deal.id} className="text-center">
                          <p className="text-sm font-medium text-muted-foreground mb-3 truncate">{deal.name}</p>
                          <div className="flex justify-center relative">
                            {deal.score_result?.overallScore === bestOverallScore && bestOverallScore > 0 && (
                              <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs">
                                Best
                              </Badge>
                            )}
                            <ScoreRing score={deal.score_result?.overallScore || 0} size="lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pillar Scores */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Pillar Scores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pillarConfig.map(pillar => {
                      const bestPillarScore = Math.max(
                        ...comparedDeals.map(d => d.score_result?.pillarScores?.[pillar.key as keyof typeof d.score_result.pillarScores] || 0)
                      );
                      
                      return (
                        <div key={pillar.key} className="border-b border-border pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2 mb-3">
                            <pillar.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">{pillar.label}</span>
                          </div>
                          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                            {comparedDeals.map(deal => {
                              const score = deal.score_result?.pillarScores?.[pillar.key as keyof typeof deal.score_result.pillarScores];
                              const isBest = score === bestPillarScore && bestPillarScore > 0;
                              
                              return (
                                <div 
                                  key={deal.id} 
                                  className={`text-center p-3 rounded-lg ${getScoreBg(score)} ${isBest ? "ring-2 ring-primary/30" : ""}`}
                                >
                                  <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                                    {score ?? "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Vehicle Details */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      Vehicle Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "Year", key: "year" },
                      { label: "Make", key: "make" },
                      { label: "Model", key: "model" },
                      { label: "Trim", key: "trim" },
                      { label: "Mileage", key: "mileage", format: formatNumber },
                    ].map(row => (
                      <div key={row.key} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <p className="text-sm text-muted-foreground mb-2">{row.label}</p>
                        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                          {comparedDeals.map(deal => (
                            <div key={deal.id} className="text-center">
                              <span className="text-sm font-medium text-foreground">
                                {row.format 
                                  ? row.format(deal[row.key as keyof Deal] as string | null)
                                  : (deal[row.key as keyof Deal] as string) || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Pricing Details */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Pricing & Financing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "Asking Price", key: "asking_price", format: formatPrice },
                      { label: "Negotiated Price", key: "negotiated_price", format: formatPrice },
                      { label: "Down Payment", key: "down_payment", format: formatPrice },
                      { label: "APR", key: "apr", suffix: "%" },
                      { label: "Term", key: "term", suffix: " months" },
                    ].map(row => {
                      // Find lowest price for highlighting
                      const prices = comparedDeals.map(d => {
                        const val = d[row.key as keyof Deal] as string | null;
                        if (!val) return Infinity;
                        return parseFloat(val.replace(/[^0-9.]/g, "")) || Infinity;
                      });
                      const lowestPrice = Math.min(...prices.filter(p => p !== Infinity));
                      
                      return (
                        <div key={row.key} className="border-b border-border pb-3 last:border-0 last:pb-0">
                          <p className="text-sm text-muted-foreground mb-2">{row.label}</p>
                          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                            {comparedDeals.map((deal, idx) => {
                              const value = deal[row.key as keyof Deal] as string | null;
                              const numValue = value ? parseFloat(value.replace(/[^0-9.]/g, "")) : null;
                              const isLowest = row.key.includes("price") && numValue === lowestPrice && lowestPrice !== Infinity;
                              
                              return (
                                <div key={deal.id} className={`text-center p-2 rounded-lg ${isLowest ? "bg-score-excellent/10 ring-1 ring-score-excellent/30" : ""}`}>
                                  <span className={`text-sm font-medium ${isLowest ? "text-score-excellent" : "text-foreground"}`}>
                                    {row.format 
                                      ? row.format(value)
                                      : value 
                                        ? `${value}${row.suffix || ""}`
                                        : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Monthly Cost Projections */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      Monthly Cost Projections
                    </CardTitle>
                    <CardDescription>Estimated total cost of ownership per month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Total Monthly Cost - Highlighted */}
                    <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                      <p className="text-sm font-medium text-primary mb-3 flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Total Monthly Cost
                      </p>
                      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                        {(() => {
                          const costs = comparedDeals.map(d => calculateTotalMonthlyCost(d));
                          const validCosts = costs.filter(c => c !== null && c.total > 0);
                          const lowestTotal = validCosts.length > 0 
                            ? Math.min(...validCosts.map(c => c!.total))
                            : null;
                          
                          return comparedDeals.map((deal, idx) => {
                            const cost = costs[idx];
                            const isLowest = cost && lowestTotal && cost.total === lowestTotal;
                            
                            return (
                              <div key={deal.id} className="text-center relative">
                                {isLowest && (
                                  <Badge className="absolute -top-2 -right-2 bg-score-excellent text-white text-xs">
                                    Best
                                  </Badge>
                                )}
                                <p className={`text-3xl font-bold ${isLowest ? "text-score-excellent" : "text-foreground"}`}>
                                  {cost && cost.total > 0 ? formatPrice(cost.total.toString()) : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">/month</p>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="space-y-4">
                      {[
                        { label: "Car Payment", icon: Car, getVal: (c: ReturnType<typeof calculateTotalMonthlyCost>) => c?.payment },
                        { label: "Insurance", icon: ShieldCheck, getVal: (c: ReturnType<typeof calculateTotalMonthlyCost>) => c?.insurance },
                        { label: "Fuel", icon: Fuel, getVal: (c: ReturnType<typeof calculateTotalMonthlyCost>) => c?.fuel },
                        { label: "Maintenance", icon: Wrench, getVal: (c: ReturnType<typeof calculateTotalMonthlyCost>) => c?.maintenance },
                        { label: "Registration", icon: FileText, getVal: (c: ReturnType<typeof calculateTotalMonthlyCost>) => c?.registration },
                      ].map(row => {
                        const costs = comparedDeals.map(d => calculateTotalMonthlyCost(d));
                        const values = costs.map(c => row.getVal(c) || 0);
                        const validValues = values.filter(v => v > 0);
                        const lowestVal = validValues.length > 0 ? Math.min(...validValues) : null;
                        
                        return (
                          <div key={row.label} className="border-b border-border pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 mb-2">
                              <row.icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{row.label}</span>
                            </div>
                            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                              {comparedDeals.map((deal, idx) => {
                                const value = values[idx];
                                const isLowest = lowestVal !== null && value === lowestVal && value > 0;
                                
                                return (
                                  <div key={deal.id} className={`text-center p-2 rounded-lg ${isLowest ? "bg-score-excellent/10 ring-1 ring-score-excellent/30" : ""}`}>
                                    <span className={`text-sm font-medium ${isLowest ? "text-score-excellent" : "text-foreground"}`}>
                                      {value > 0 ? formatPrice(Math.round(value).toString()) : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 5-Year Total Cost */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-3">5-Year Total Cost of Ownership</p>
                      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                        {(() => {
                          const costs = comparedDeals.map(d => calculateTotalMonthlyCost(d));
                          const fiveYearCosts = costs.map(c => c ? c.total * 60 : null);
                          const validCosts = fiveYearCosts.filter(c => c !== null && c > 0) as number[];
                          const lowestFiveYear = validCosts.length > 0 ? Math.min(...validCosts) : null;
                          
                          return comparedDeals.map((deal, idx) => {
                            const cost = fiveYearCosts[idx];
                            const isLowest = cost && lowestFiveYear && cost === lowestFiveYear;
                            
                            return (
                              <div key={deal.id} className={`text-center p-3 rounded-lg ${isLowest ? "bg-score-excellent/10 ring-1 ring-score-excellent/30" : "bg-muted/50"}`}>
                                <p className={`text-lg font-bold ${isLowest ? "text-score-excellent" : "text-foreground"}`}>
                                  {cost && cost > 0 ? formatPrice(cost.toString()) : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">over 5 years</p>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      Notes
                    </CardTitle>
                    <CardDescription>Add your thoughts and comments for each deal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                      {comparedDeals.map(deal => (
                        <div key={deal.id} className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground truncate">{deal.name}</p>
                          <Textarea
                            placeholder="Add notes about this deal..."
                            value={dealNotes[deal.id] || ""}
                            onChange={(e) => updateNote(deal.id, e.target.value)}
                            className="min-h-[100px] resize-none text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Created Date */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Deal Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparedDeals.length}, 1fr)` }}>
                      {comparedDeals.map(deal => (
                        <div key={deal.id} className="text-center">
                          <p className="text-sm text-muted-foreground">Created</p>
                          <p className="text-sm font-medium text-foreground mt-1">
                            {format(new Date(deal.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            </div>
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Scale className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Deals Selected</h3>
              <p className="text-muted-foreground mb-6">
                Select deals above to start comparing them side-by-side
              </p>
              <Button onClick={() => setShowSelector(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Select Deals to Compare
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
