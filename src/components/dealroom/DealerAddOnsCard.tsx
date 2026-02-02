import { Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DealerAddOnsCardProps {
  addOns: number;
  dealerFee: number;
  docFee: number;
  askingPrice: number;
  onViewScripts?: () => void;
}

export function DealerAddOnsCard({
  addOns,
  dealerFee,
  docFee,
  askingPrice,
  onViewScripts,
}: DealerAddOnsCardProps) {
  const totalNegotiable = addOns + dealerFee;
  const hasNegotiableItems = totalNegotiable > 0;
  const hasHighDocFee = docFee > 500;
  
  const negotiableItems = [
    { label: "Add-ons (protection packages, accessories)", value: addOns, isNegotiable: true },
    { label: "Dealer Fee / Admin Fee", value: dealerFee, isNegotiable: true },
    { label: "Doc Fee", value: docFee, isNegotiable: hasHighDocFee, note: hasHighDocFee ? "Higher than typical ($300-500)" : "Standard range" },
  ].filter(item => item.value > 0);
  
  if (negotiableItems.length === 0) {
    return (
      <Card className="border border-border shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
              <Package className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </div>
            Dealer Add-Ons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No dealer add-ons or unusual fees detected.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`border shadow-card ${
      hasNegotiableItems ? "border-yellow-200 dark:border-yellow-800" : "border-border"
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            hasNegotiableItems 
              ? "bg-yellow-100 dark:bg-yellow-900/30" 
              : "bg-gray-100 dark:bg-gray-900/30"
          }`}>
            <Package className={`h-4 w-4 ${
              hasNegotiableItems 
                ? "text-yellow-600 dark:text-yellow-400" 
                : "text-gray-600 dark:text-gray-400"
            }`} />
          </div>
          Dealer Add-Ons Detected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items List */}
        <div className="space-y-2">
          {negotiableItems.map((item, idx) => (
            <div 
              key={idx}
              className={`flex items-start justify-between p-3 rounded-lg ${
                item.isNegotiable 
                  ? "bg-yellow-50 dark:bg-yellow-950/20" 
                  : "bg-muted"
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                {item.note && (
                  <p className="text-xs text-muted-foreground">{item.note}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">
                  ${item.value.toLocaleString()}
                </p>
                {item.isNegotiable && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Negotiable</p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Total Negotiable */}
        {totalNegotiable > 0 && (
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  Potentially Negotiable
                </span>
              </div>
              <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                ${totalNegotiable.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These items are commonly removed or discounted during negotiation.
            </p>
          </div>
        )}
        
        {/* CTA */}
        {onViewScripts && totalNegotiable > 0 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onViewScripts}
          >
            See what to say about add-ons
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
