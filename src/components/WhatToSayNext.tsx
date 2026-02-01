import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, XCircle, Percent, LogOut, Copy, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DealData {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  askingPrice?: string;
  negotiatedPrice?: string;
  apr?: string;
  term?: string;
  docFee?: string;
  dealerFee?: string;
  addOns?: string;
  monthlyIncome?: string;
}

interface ScoreResult {
  overall: number;
  trueMarketPrice: number;
  dealPriceGap: number;
  dealPriceGapPercent: number;
  monthlyPayment: number;
  recommendation: string;
}

interface WhatToSayNextProps {
  dealData: DealData;
  scoreResult: ScoreResult | null;
}

type ScriptType = "counter" | "fees" | "buyrate" | "walkaway";

interface GeneratedScript {
  type: ScriptType;
  title: string;
  script: string;
  tips: string[];
}

const scriptOptions = [
  {
    type: "counter" as ScriptType,
    title: "Counter Offer",
    description: "Get a script to negotiate a better price",
    icon: DollarSign,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
  },
  {
    type: "fees" as ScriptType,
    title: "Remove Fees",
    description: "Challenge unnecessary dealer add-ons",
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
  {
    type: "buyrate" as ScriptType,
    title: "Ask for Buy Rate",
    description: "Request the dealer's actual interest rate",
    icon: Percent,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    type: "walkaway" as ScriptType,
    title: "Walk Away",
    description: "Leave with power and keep the door open",
    icon: LogOut,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
];

export function WhatToSayNext({ dealData, scoreResult }: WhatToSayNextProps) {
  const [loadingType, setLoadingType] = useState<ScriptType | null>(null);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const { toast } = useToast();

  const vehicleInfo = [dealData.year, dealData.make, dealData.model, dealData.trim]
    .filter(Boolean)
    .join(" ");

  const hasMinimumData = dealData.year && dealData.make && dealData.askingPrice;

  const generateScript = async (type: ScriptType) => {
    if (!hasMinimumData) {
      toast({
        title: "More info needed",
        description: "Please add at least Year, Make, and Asking Price in 'The Deal' tab first.",
        variant: "destructive",
      });
      return;
    }

    setLoadingType(type);
    setGeneratedScript(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-negotiation-script`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            scriptType: type,
            dealData,
            scoreResult,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate script");
      }

      const data = await response.json();
      
      const option = scriptOptions.find(o => o.type === type);
      setGeneratedScript({
        type,
        title: option?.title || "Script",
        script: data.script,
        tips: data.tips || [],
      });

      toast({
        title: "Script Ready!",
        description: "Your negotiation script has been generated.",
      });
    } catch (error) {
      console.error("Script generation error:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Could not generate script",
        variant: "destructive",
      });
    } finally {
      setLoadingType(null);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedScript) return;
    
    try {
      await navigator.clipboard.writeText(generatedScript.script);
      setCopiedScript(true);
      toast({
        title: "Copied!",
        description: "Script copied to clipboard",
      });
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please select and copy manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">What To Say Next</h2>
        </div>
        <p className="text-muted-foreground">
          {vehicleInfo 
            ? `Generate dealer-ready scripts for your ${vehicleInfo}`
            : "Get AI-powered negotiation scripts tailored to your deal"}
        </p>
      </div>

      {/* Script Buttons */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scriptOptions.map((option) => {
          const Icon = option.icon;
          const isLoading = loadingType === option.type;
          const isSelected = generatedScript?.type === option.type;
          
          return (
            <button
              key={option.type}
              onClick={() => generateScript(option.type)}
              disabled={loadingType !== null}
              className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left group
                ${isSelected 
                  ? `${option.borderColor} ${option.bgColor} ring-2 ring-offset-2 ring-primary/50` 
                  : `border-border bg-card hover:${option.bgColor} hover:${option.borderColor}`}
                ${loadingType !== null && !isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${option.bgColor}`}>
                  {isLoading ? (
                    <Loader2 className={`h-5 w-5 ${option.color} animate-spin`} />
                  ) : (
                    <Icon className={`h-5 w-5 ${option.color}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{option.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className={`h-4 w-4 ${option.color}`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Generated Script Display */}
      {generatedScript && (
        <Card className="border-2 border-primary/20 bg-accent/30 animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {scriptOptions.find(o => o.type === generatedScript.type)?.icon && (
                  (() => {
                    const Icon = scriptOptions.find(o => o.type === generatedScript.type)!.icon;
                    const color = scriptOptions.find(o => o.type === generatedScript.type)!.color;
                    return <Icon className={`h-5 w-5 ${color}`} />;
                  })()
                )}
                {generatedScript.title} Script
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                className="gap-2"
              >
                {copiedScript ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <CardDescription>
              Use this script when talking to the dealer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* The Script */}
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                "{generatedScript.script}"
              </p>
            </div>

            {/* Tips */}
            {generatedScript.tips.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Pro Tips:</h4>
                <ul className="space-y-1">
                  {generatedScript.tips.map((tip, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!generatedScript && !loadingType && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">
            {hasMinimumData 
              ? "Choose a script type above to generate your negotiation script"
              : "Add your deal details first, then come back here for negotiation scripts"}
          </p>
        </div>
      )}
    </div>
  );
}
