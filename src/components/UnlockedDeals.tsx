import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, ExternalLink, CheckCircle2, Lock, Calendar, Receipt } from "lucide-react";
import { format } from "date-fns";

interface DealEntitlement {
  id: string;
  deal_id: string;
  status: "locked" | "unlocked";
  unlocked_at: string | null;
  stripe_payment_intent_id: string | null;
  deal?: {
    id: string;
    name: string;
    year: string | null;
    make: string | null;
    model: string | null;
  };
}

export const UnlockedDeals = () => {
  const [entitlements, setEntitlements] = useState<DealEntitlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEntitlements();
  }, []);

  const loadEntitlements = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get entitlements with deal info
      const { data, error } = await supabase
        .from("deal_entitlements")
        .select(`
          id,
          deal_id,
          status,
          unlocked_at,
          stripe_payment_intent_id
        `)
        .eq("user_id", user.id)
        .order("unlocked_at", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error loading entitlements:", error);
        return;
      }

      // Fetch deals separately since we can't do nested joins with new tables
      if (data && data.length > 0) {
        const dealIds = data.map(e => e.deal_id);
        const { data: deals } = await supabase
          .from("deals")
          .select("id, name, year, make, model")
          .in("id", dealIds);

        const dealsMap = new Map(deals?.map(d => [d.id, d]) || []);
        
        const entitlementsWithDeals: DealEntitlement[] = data.map(e => ({
          ...e,
          status: e.status as "locked" | "unlocked",
          deal: dealsMap.get(e.deal_id),
        }));

        setEntitlements(entitlementsWithDeals);
      } else {
        setEntitlements([]);
      }
    } catch (error) {
      console.error("Error loading entitlements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDealDisplayName = (entitlement: DealEntitlement) => {
    if (!entitlement.deal) return "Unknown Deal";
    const { name, year, make, model } = entitlement.deal;
    if (name && name !== "Untitled Deal") return name;
    const vehicleInfo = [year, make, model].filter(Boolean).join(" ");
    return vehicleInfo || "Untitled Deal";
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your deals...
      </div>
    );
  }

  const unlockedEntitlements = entitlements.filter(e => e.status === "unlocked");
  const lockedEntitlements = entitlements.filter(e => e.status === "locked");

  if (entitlements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Car className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No deals yet</p>
        <p className="text-sm">Save a deal in the Deal Room to get started</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/deal-room">Go to Deal Room</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unlocked Deals */}
      {unlockedEntitlements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Unlocked ({unlockedEntitlements.length})
          </h4>
          {unlockedEntitlements.map((entitlement) => (
            <div
              key={entitlement.id}
              className="flex items-center justify-between p-4 rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-950/20"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Car className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {getDealDisplayName(entitlement)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Unlocked
                    </Badge>
                    {entitlement.unlocked_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(entitlement.unlocked_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  {entitlement.stripe_payment_intent_id && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Receipt className="h-3 w-3" />
                      Payment: {entitlement.stripe_payment_intent_id.slice(0, 20)}...
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/deal-room?dealId=${entitlement.deal_id}`}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Locked Deals */}
      {lockedEntitlements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Pending Unlock ({lockedEntitlements.length})
          </h4>
          {lockedEntitlements.slice(0, 3).map((entitlement) => (
            <div
              key={entitlement.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Car className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {getDealDisplayName(entitlement)}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    <Lock className="h-3 w-3 mr-1" />
                    Locked
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/deal-room?dealId=${entitlement.deal_id}`}>
                  Unlock for $9.99
                </Link>
              </Button>
            </div>
          ))}
          {lockedEntitlements.length > 3 && (
            <p className="text-xs text-muted-foreground text-center">
              +{lockedEntitlements.length - 3} more locked deals
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      {unlockedEntitlements.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total unlocked</span>
            <span className="font-medium">{unlockedEntitlements.length} deal{unlockedEntitlements.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-muted-foreground">Amount spent</span>
            <span className="font-medium">${(unlockedEntitlements.length * 9.99).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnlockedDeals;
