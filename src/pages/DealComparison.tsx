import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
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
  Scale
} from "lucide-react";
import { format } from "date-fns";
import { User } from "@supabase/supabase-js";

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
  const { toast } = useToast();
  const navigate = useNavigate();

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
        .select("id, name, year, make, model, trim, mileage, asking_price, negotiated_price, down_payment, apr, term, score_result, created_at")
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
            <Button onClick={() => setShowSelector(!showSelector)}>
              <Plus className="h-4 w-4 mr-2" />
              {showSelector ? "Hide Selection" : "Select Deals"}
            </Button>
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
            {/* Selected Deals Pills */}
            <div className="flex flex-wrap gap-2">
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
