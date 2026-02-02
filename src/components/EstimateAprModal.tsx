import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HelpCircle, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type CreditTier = "excellent" | "good" | "fair" | "building" | "unknown";
export type VehicleCondition = "new" | "used";
export type LoanTerm = 36 | 48 | 60 | 72 | 84;

interface EstimateAprModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCreditTier?: CreditTier;
  defaultCondition?: VehicleCondition;
  defaultTermMonths?: LoanTerm;
  defaultZip?: string;
  onApply: (payload: {
    creditTier: CreditTier;
    vehicleCondition: VehicleCondition;
    termMonths: LoanTerm;
    zip?: string;
    aprEstimated: string;
  }) => void;
}

// Conservative APR mapping based on credit tier and vehicle condition
function estimateApr(creditTier: CreditTier, condition: VehicleCondition): number {
  const baseRates: Record<CreditTier, number> = {
    excellent: 6.5,
    good: 8.0,
    fair: 10.5,
    building: 13.5,
    unknown: 10.5,
  };

  const base = baseRates[creditTier];
  // Used cars generally have higher APR
  const conditionBump = condition === "used" ? 1.0 : 0.0;

  return Math.round((base + conditionBump) * 10) / 10;
}

// Get APR range for display
function getAprRange(creditTier: CreditTier): string {
  const ranges: Record<CreditTier, string> = {
    excellent: "5.5% – 7.0%",
    good: "7.0% – 9.0%",
    fair: "9.0% – 13.0%",
    building: "12.0% – 16.0%",
    unknown: "9.5% – 13.0%",
  };
  return ranges[creditTier];
}

export function EstimateAprModal({
  open,
  onOpenChange,
  defaultCreditTier = "unknown",
  defaultCondition = "new",
  defaultTermMonths = 60,
  defaultZip = "",
  onApply,
}: EstimateAprModalProps) {
  const [creditTier, setCreditTier] = useState<CreditTier>(defaultCreditTier);
  const [vehicleCondition, setVehicleCondition] = useState<VehicleCondition>(defaultCondition);
  const [termMonths, setTermMonths] = useState<LoanTerm>(defaultTermMonths);
  const [zip, setZip] = useState(defaultZip);
  const [showHelp, setShowHelp] = useState(false);

  const estimatedApr = estimateApr(creditTier, vehicleCondition);

  const handleApply = () => {
    onApply({
      creditTier,
      vehicleCondition,
      termMonths,
      zip: zip || undefined,
      aprEstimated: estimatedApr.toString(),
    });
    onOpenChange(false);
  };

  const termOptions: LoanTerm[] = [36, 48, 60, 72, 84];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Estimate my APR</DialogTitle>
          <DialogDescription>
            APR depends mostly on credit and term. If you don't know your exact rate yet, we'll use a conservative estimate and you can update it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Credit Score Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Credit score range</Label>
            <RadioGroup
              value={creditTier}
              onValueChange={(v) => setCreditTier(v as CreditTier)}
              className="grid gap-2"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="excellent" id="excellent" />
                <Label htmlFor="excellent" className="font-normal cursor-pointer">
                  Excellent (740+)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="good" id="good" />
                <Label htmlFor="good" className="font-normal cursor-pointer">
                  Good (680–739)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="fair" id="fair" />
                <Label htmlFor="fair" className="font-normal cursor-pointer">
                  Fair (620–679)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="building" id="building" />
                <Label htmlFor="building" className="font-normal cursor-pointer">
                  Building credit (&lt;620)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="unknown" id="unknown" />
                <Label htmlFor="unknown" className="font-normal cursor-pointer">
                  Not sure
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Vehicle type</Label>
            <RadioGroup
              value={vehicleCondition}
              onValueChange={(v) => setVehicleCondition(v as VehicleCondition)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal cursor-pointer">
                  New
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="used" id="used" />
                <Label htmlFor="used" className="font-normal cursor-pointer">
                  Used
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Loan Term */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Loan term</Label>
            <div className="flex flex-wrap gap-2">
              {termOptions.map((term) => (
                <Button
                  key={term}
                  type="button"
                  variant={termMonths === term ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTermMonths(term)}
                  className="min-w-[4rem]"
                >
                  {term} mo
                </Button>
              ))}
            </div>
          </div>

          {/* ZIP (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="zip" className="text-sm font-medium">
              ZIP code <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="zip"
              type="text"
              placeholder="07016"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              maxLength={5}
              className="max-w-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Helps us tailor estimates to typical local pricing/taxes.
            </p>
          </div>

          {/* Estimated APR Result */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estimated APR (conservative)</span>
              <span className="text-lg font-semibold text-primary">{estimatedApr}%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Typical range for {creditTier === "unknown" ? "average credit" : creditTier + " credit"}: {getAprRange(creditTier)}
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              This is an estimate. If your dealer or bank quotes a different APR, update it and we'll recalculate instantly.
            </p>
          </div>

          {/* Where to find APR help */}
          <Collapsible open={showHelp} onOpenChange={setShowHelp}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-sm text-primary hover:underline">
                <HelpCircle className="h-4 w-4" />
                Where do I find APR?
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm text-muted-foreground">
                <p>• <strong>Dealer worksheet:</strong> look for "APR" or "Rate"</p>
                <p>• <strong>Bank/credit union pre-approval:</strong> check the email or letter</p>
                <p>• <strong>Ask the dealer:</strong> "What APR and term are you quoting me?"</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Use this APR estimate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
