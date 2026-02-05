import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Save, FolderOpen, Trash2, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScoreRing } from "./ScoreRing";

interface Deal {
  id: string;
  name: string;
  year: string | null;
  make: string | null;
  model: string | null;
  asking_price: string | null;
  score_result: any;
  created_at: string;
  status?: string;
  progress?: number;
}

interface SavedDealsProps {
  dealData: Record<string, string>;
  scoreResult: any;
  onLoadDeal: (deal: Deal) => void;
  onNewDeal: () => void;
}

export function SavedDeals({ dealData, scoreResult, onLoadDeal, onNewDeal }: SavedDealsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dealName, setDealName] = useState("");
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDeals = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error) {
      console.error("Error loading deals:", error);
      toast({
        title: "Error",
        description: "Failed to load saved deals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      loadDeals();
    }
  }, [isOpen, user]);

  const saveDeal = async () => {
    if (!user) {
      toast({
        title: "Sign in Required",
        description: "Please sign in to save deals",
        variant: "destructive",
      });
      return;
    }

    if (!dealName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this deal",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("deals").insert({
        user_id: user.id,
        name: dealName.trim(),
        year: dealData.year || null,
        make: dealData.make || null,
        model: dealData.model || null,
        trim: dealData.trim || null,
        mileage: dealData.mileage || null,
        vin: dealData.vin || null,
        dealer_zip: dealData.dealerZip || null,
        asking_price: dealData.askingPrice || null,
        negotiated_price: dealData.negotiatedPrice || null,
        down_payment: dealData.downPayment || null,
        trade_in: dealData.tradeIn || null,
        apr: dealData.apr || null,
        term: dealData.term || null,
        doc_fee: dealData.docFee || null,
        dealer_fee: dealData.dealerFee || null,
        add_ons: dealData.addOns || null,
        taxes: dealData.taxes || null,
        registration: dealData.registration || null,
        buyer_zip: dealData.buyerZip || null,
        monthly_income: dealData.monthlyIncome || null,
        credit_score: dealData.creditScore || null,
        insurance: dealData.insurance || null,
        fuel_cost: dealData.fuelCost || null,
        maintenance: dealData.maintenance || null,
        score_result: scoreResult || null,
      });

      if (error) throw error;

      toast({
        title: "Deal Saved!",
        description: `"${dealName}" has been saved to your account`,
      });
      setDealName("");
      loadDeals();
    } catch (error) {
      console.error("Error saving deal:", error);
      toast({
        title: "Error",
        description: "Failed to save deal",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDeal = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "Deal Deleted",
        description: `"${name}" has been removed`,
      });
      loadDeals();
    } catch (error) {
      console.error("Error deleting deal:", error);
      toast({
        title: "Error",
        description: "Failed to delete deal",
        variant: "destructive",
      });
    }
  };

  const handleLoadDeal = (deal: Deal) => {
    onLoadDeal(deal);
    setIsOpen(false);
    toast({
      title: "Deal Loaded",
      description: `"${deal.name}" has been loaded`,
    });
  };

  if (!user) {
    return (
      <Button variant="outline" onClick={() => window.location.href = "/auth"}>
        <Save className="h-4 w-4 mr-2" />
        Sign in to Save
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex gap-2">
        <DialogTrigger asChild>
          <Button variant="outline">
            <FolderOpen className="h-4 w-4 mr-2" />
            My Deals
          </Button>
        </DialogTrigger>
        <Button variant="outline" onClick={onNewDeal}>
          <Plus className="h-4 w-4 mr-2" />
          New Deal
        </Button>
      </div>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your Saved Deals</DialogTitle>
        </DialogHeader>

        {/* Save Current Deal */}
        <div className="p-4 rounded-xl bg-muted mb-4">
          <p className="text-sm font-medium mb-2">Save Current Deal</p>
          <div className="flex gap-2">
            <Input
              placeholder="Deal name (e.g., Honda Accord from ABC Motors)"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
            />
            <Button onClick={saveDeal} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Saved Deals List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No saved deals yet</p>
            <p className="text-sm">Save a deal to compare later</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {(deal.score_result?.overall || deal.score_result?.overallScore) && (
                    <ScoreRing score={deal.score_result?.overall || deal.score_result?.overallScore} size="sm" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{deal.name}</p>
                      {deal.status === "draft" && (
                        <Badge variant="secondary" className="text-xs shrink-0">Draft</Badge>
                      )}
                    </div>
                    {deal.status === "draft" && deal.progress ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={deal.progress} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{deal.progress}%</span>
                      </div>
                    ) : (
                    <p className="text-sm text-muted-foreground">
                      {[deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "No vehicle details"}
                      {deal.asking_price && ` • $${Number(deal.asking_price).toLocaleString()}`}
                    </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleLoadDeal(deal)}>
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteDeal(deal.id, deal.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
