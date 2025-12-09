import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ScoreResult } from "@/lib/duodriveScore";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");

interface EmailShareDialogProps {
  scoreResult: ScoreResult;
  dealData: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  trigger?: React.ReactNode;
}

export function EmailShareDialog({ scoreResult, dealData, trigger }: EmailShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const vehicleInfo = `${dealData.year || ""} ${dealData.make || ""} ${dealData.model || ""} ${dealData.trim || ""}`.trim() || "Vehicle";

  const handleSend = async () => {
    setError("");
    
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke("send-score-report", {
        body: {
          recipientEmail: email,
          vehicleInfo,
          overallScore: scoreResult.overall,
          recommendation: scoreResult.recommendation,
          metrics: {
            trueMarketPrice: scoreResult.trueMarketPrice,
            dealPriceGap: scoreResult.dealPriceGap,
            dealPriceGapPercent: scoreResult.dealPriceGapPercent,
            customerMaxSafePrice: scoreResult.customerMaxSafePrice,
            customerFitGap: scoreResult.customerFitGap,
            customerFitGapPercent: scoreResult.customerFitGapPercent,
            monthlyPayment: scoreResult.monthlyPayment,
            totalCost: scoreResult.totalCost,
          },
          pillars: {
            depreciation: scoreResult.pillars.depreciation,
            reliability: scoreResult.pillars.reliability,
            safety: scoreResult.pillars.safety,
            dealHealth: scoreResult.pillars.dealHealth,
            affordability: scoreResult.pillars.affordability,
          },
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (fnError) throw fnError;

      toast({
        title: "Report Sent!",
        description: `Score report has been sent to ${email}`,
      });
      setOpen(false);
      setEmail("");
    } catch (err: any) {
      console.error("Email send error:", err);
      toast({
        title: "Failed to Send",
        description: err.message || "Could not send the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Email Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Share Score Report
          </DialogTitle>
          <DialogDescription>
            Send your DuoDrive Score report for the {vehicleInfo} to any email address.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">
              The report will include:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Overall score: <span className="font-medium text-foreground">{scoreResult.overall}</span></li>
              <li>• Market & budget analysis (TMP, DPG, CMSP, CFG)</li>
              <li>• All 5 pillar scores with details</li>
              <li>• AI recommendation</li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !email.trim()}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
