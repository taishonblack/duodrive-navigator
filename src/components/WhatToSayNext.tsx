import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, DollarSign, XCircle, Percent, LogOut, Copy, Check, Sparkles, AlertTriangle } from "lucide-react";
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

export interface FeeContext {
  junkFees: string[];
  negotiableFees: string[];
  junkTotal: number;
  negotiableTotal: number;
  savingsPotential: number;
  prebuiltScript: string | null;
}

interface WhatToSayNextProps {
  dealData: DealData;
  scoreResult: ScoreResult | null;
  feeContext?: FeeContext;
}

type ScriptType = "counter" | "fees" | "buyrate" | "walkaway";

interface GeneratedScript {
  type: ScriptType;
  title: string;
  script: string;
  tips: string[];
  isPrebuilt?: boolean;
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

export function WhatToSayNext({ dealData, scoreResult, feeContext }: WhatToSayNextProps) {
  const [loadingType, setLoadingType] = useState<ScriptType | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [generatedScripts, setGeneratedScripts] = useState<Map<ScriptType, GeneratedScript>>(new Map());
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const { toast } = useToast();

  const vehicleInfo = [dealData.year, dealData.make, dealData.model, dealData.trim]
    .filter(Boolean)
    .join(" ");

  const hasMinimumData = dealData.year && dealData.make && dealData.askingPrice;
  
  // Check if we have junk/negotiable fees from FeeBreakdown
  const hasFeeIssues = feeContext && (feeContext.junkTotal > 0 || feeContext.negotiableTotal > 0);

  // Auto-show fee script if we have prebuilt content from FeeBreakdown
  useEffect(() => {
    if (feeContext?.prebuiltScript && !generatedScript) {
      const tips = [];
      if (feeContext.junkFees.length > 0) {
        tips.push(`Junk fees to remove: ${feeContext.junkFees.join(", ")}`);
      }
      if (feeContext.negotiableFees.length > 0) {
        tips.push(`Fees to negotiate: ${feeContext.negotiableFees.join(", ")}`);
      }
      if (feeContext.savingsPotential > 0) {
        tips.push(`Potential savings: $${feeContext.savingsPotential.toLocaleString()}`);
      }
      tips.push("Stay calm and polite - firmness works better than aggression");
      tips.push("If they refuse, ask to speak with the sales manager");
      
      const feeScript: GeneratedScript = {
        type: "fees",
        title: "Remove Fees",
        script: feeContext.prebuiltScript,
        tips,
        isPrebuilt: true,
      };
      
      setGeneratedScript(feeScript);
      setGeneratedScripts(prev => new Map(prev).set("fees", feeScript));
    }
  }, [feeContext?.prebuiltScript]);

  const generateScript = async (type: ScriptType) => {
    if (!hasMinimumData) {
      toast({
        title: "More info needed",
        description: "Please add at least Year, Make, and Asking Price in 'The Deal' tab first.",
        variant: "destructive",
      });
      return;
    }

    // For fees, if we have prebuilt context, enhance the request
    if (type === "fees" && feeContext?.prebuiltScript) {
      // Use prebuilt script from FeeBreakdown
      const tips = [];
      if (feeContext.junkFees.length > 0) {
        tips.push(`Junk fees to remove: ${feeContext.junkFees.join(", ")}`);
      }
      if (feeContext.negotiableFees.length > 0) {
        tips.push(`Fees to negotiate: ${feeContext.negotiableFees.join(", ")}`);
      }
      if (feeContext.savingsPotential > 0) {
        tips.push(`Potential savings: $${feeContext.savingsPotential.toLocaleString()}`);
      }
      tips.push("Stay calm and polite - firmness works better than aggression");
      tips.push("If they refuse, ask to speak with the sales manager");
      
      setGeneratedScript({
        type: "fees",
        title: "Remove Fees",
        script: feeContext.prebuiltScript,
        tips,
        isPrebuilt: true,
      });
      
      toast({
        title: "Script Ready!",
        description: "Fee negotiation script based on your deal's fee analysis.",
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
            feeContext: type === "fees" ? feeContext : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate script");
      }

      const data = await response.json();
      
      const option = scriptOptions.find(o => o.type === type);
      const newScript: GeneratedScript = {
        type,
        title: option?.title || "Script",
        script: data.script,
        tips: data.tips || [],
      };
      
      setGeneratedScript(newScript);
      setGeneratedScripts(prev => new Map(prev).set(type, newScript));

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

  const copyAllScripts = async () => {
    const allScripts: string[] = [];
    
    // Collect all generated scripts
    generatedScripts.forEach((script, type) => {
      allScripts.push(`--- ${script.title.toUpperCase()} SCRIPT ---\n\n"${script.script}"`);
    });
    
    if (allScripts.length === 0) {
      toast({
        title: "No scripts to copy",
        description: "Generate at least one script first",
        variant: "destructive",
      });
      return;
    }
    
    const combinedText = allScripts.join("\n\n\n");
    
    try {
      await navigator.clipboard.writeText(combinedText);
      setCopiedAll(true);
      toast({
        title: "All Scripts Copied!",
        description: `${allScripts.length} script(s) copied to clipboard`,
      });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please select and copy manually",
        variant: "destructive",
      });
    }
  };

  const generateAllScripts = async () => {
    if (!hasMinimumData) {
      toast({
        title: "More info needed",
        description: "Please add at least Year, Make, and Asking Price in 'The Deal' tab first.",
        variant: "destructive",
      });
      return;
    }

    setLoadingAll(true);
    const scriptsToGenerate: ScriptType[] = ["counter", "fees", "buyrate", "walkaway"];
    const newScripts = new Map<ScriptType, GeneratedScript>();
    let successCount = 0;

    // Handle prebuilt fee script first if available
    if (feeContext?.prebuiltScript) {
      const tips = [];
      if (feeContext.junkFees.length > 0) {
        tips.push(`Junk fees to remove: ${feeContext.junkFees.join(", ")}`);
      }
      if (feeContext.negotiableFees.length > 0) {
        tips.push(`Fees to negotiate: ${feeContext.negotiableFees.join(", ")}`);
      }
      if (feeContext.savingsPotential > 0) {
        tips.push(`Potential savings: $${feeContext.savingsPotential.toLocaleString()}`);
      }
      tips.push("Stay calm and polite - firmness works better than aggression");
      tips.push("If they refuse, ask to speak with the sales manager");
      
      newScripts.set("fees", {
        type: "fees",
        title: "Remove Fees",
        script: feeContext.prebuiltScript,
        tips,
        isPrebuilt: true,
      });
      successCount++;
    }

    // Generate remaining scripts in parallel
    const scriptsToFetch = feeContext?.prebuiltScript 
      ? scriptsToGenerate.filter(t => t !== "fees")
      : scriptsToGenerate;

    const results = await Promise.allSettled(
      scriptsToFetch.map(async (type) => {
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
              feeContext: type === "fees" ? feeContext : undefined,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to generate ${type} script`);
        }

        const data = await response.json();
        const option = scriptOptions.find(o => o.type === type);
        
        return {
          type,
          title: option?.title || "Script",
          script: data.script,
          tips: data.tips || [],
        } as GeneratedScript;
      })
    );

    // Process results
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        newScripts.set(result.value.type, result.value);
        successCount++;
      }
    });

    // Update state with all generated scripts
    setGeneratedScripts(newScripts);
    
    // Show the first generated script
    if (newScripts.size > 0) {
      const firstScript = newScripts.get("counter") || newScripts.values().next().value;
      setGeneratedScript(firstScript);
    }

    setLoadingAll(false);

    if (successCount === scriptsToGenerate.length) {
      toast({
        title: "All Scripts Ready!",
        description: `${successCount} negotiation scripts generated successfully.`,
      });
    } else if (successCount > 0) {
      toast({
        title: "Scripts Partially Generated",
        description: `${successCount} of ${scriptsToGenerate.length} scripts generated.`,
      });
    } else {
      toast({
        title: "Generation Failed",
        description: "Could not generate scripts. Please try again.",
        variant: "destructive",
      });
    }
  };

  const regenerateWithAI = async () => {
    if (!generatedScript || generatedScript.type !== "fees") return;
    
    setLoadingType("fees");
    
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
            scriptType: "fees",
            dealData,
            scoreResult,
            feeContext,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to regenerate script");
      }

      const data = await response.json();
      
      setGeneratedScript({
        type: "fees",
        title: "Remove Fees",
        script: data.script,
        tips: data.tips || [],
        isPrebuilt: false,
      });

      toast({
        title: "AI Script Generated!",
        description: "Enhanced negotiation script ready.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Could not generate AI script",
        variant: "destructive",
      });
    } finally {
      setLoadingType(null);
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

      {/* Fee Alert Banner - show if we have fee issues */}
      {hasFeeIssues && !generatedScript && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Fee issues detected in your deal
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              We found ${(feeContext!.junkTotal + feeContext!.negotiableTotal).toLocaleString()} in fees that can be reduced or removed. 
              Click "Remove Fees" below for a ready-to-use script.
            </p>
          </div>
        </div>
      )}

      {/* Script Buttons */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {scriptOptions.map((option) => {
          const Icon = option.icon;
          const isLoading = loadingType === option.type || loadingAll;
          const isSelected = generatedScript?.type === option.type;
          const hasGenerated = generatedScripts.has(option.type);
          const hasFeeContext = option.type === "fees" && hasFeeIssues;
          
          return (
            <button
              key={option.type}
              onClick={() => generateScript(option.type)}
              disabled={loadingType !== null || loadingAll}
              className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left group
                ${isSelected 
                  ? `${option.borderColor} ${option.bgColor} ring-2 ring-offset-2 ring-primary/50` 
                  : hasGenerated
                    ? `${option.borderColor} ${option.bgColor}`
                    : `border-border bg-card hover:${option.bgColor} hover:${option.borderColor}`}
                ${(loadingType !== null || loadingAll) && !isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${option.bgColor}`}>
                  {loadingAll || loadingType === option.type ? (
                    <Loader2 className={`h-5 w-5 ${option.color} animate-spin`} />
                  ) : (
                    <Icon className={`h-5 w-5 ${option.color}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{option.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  {hasFeeContext && !hasGenerated && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                      Script ready from fee analysis
                    </p>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className={`h-4 w-4 ${option.color}`} />
                </div>
              )}
              {hasGenerated && !isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {hasFeeContext && !isSelected && !hasGenerated && (
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Generate All & Copy All Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={generateAllScripts}
          disabled={loadingType !== null || loadingAll || !hasMinimumData}
          className="gap-2"
        >
          {loadingAll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating All Scripts...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate All Scripts
            </>
          )}
        </Button>
        
        {generatedScripts.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={copyAllScripts}
            className="gap-2"
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4" />
                All Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All Scripts ({generatedScripts.size})
              </>
            )}
          </Button>
        )}
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
                {generatedScript.isPrebuilt && (
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    (from fee analysis)
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                {generatedScript.isPrebuilt && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={regenerateWithAI}
                    disabled={loadingType !== null}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    {loadingType === "fees" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Enhance with AI
                  </Button>
                )}
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