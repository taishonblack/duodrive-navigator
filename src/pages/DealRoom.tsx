import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScoreRing } from "@/components/ScoreRing";
import { PillarCard } from "@/components/PillarCard";
import { SavedDeals } from "@/components/SavedDeals";
import { DealRoomCopilot } from "@/components/DealRoomCopilot";
import { DealRoomTutorial } from "@/components/DealRoomTutorial";
import DealAnalysisPaywall from "@/components/DealAnalysisPaywall";
import { Upload, Calculator, Bot, BookOpen, BarChart3, TrendingDown, Wrench, Shield, DollarSign, Heart, Loader2, FileCheck, Camera, ImagePlus, FilePlus2, TrendingUp, Target, AlertTriangle, CheckCircle2, XCircle, Wallet, Download, Mail, Sparkles, Send, FileText, ArrowRight, Clipboard, Wand2, RotateCcw, HelpCircle, MessageSquare, MessageCircle, Lock } from "lucide-react";
import { WhatToSayNext, FeeContext } from "@/components/WhatToSayNext";
import { PricingConfidence } from "@/components/PricingConfidence";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { TermTooltip } from "@/components/TermTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCopilotChat, ChatMessage } from "@/hooks/useCopilotChat";
import { calculateDuoDriveScore, getDealHealthColor, getDealHealthLabel, ScoreResult } from "@/lib/duodriveScore";
import { Progress } from "@/components/ui/progress";
import { generateScoreReport } from "@/lib/pdfExport";
import { EmailShareDialog } from "@/components/EmailShareDialog";
import { parseExtractedDealData, getExtractedFieldNames, ExtractedDealData } from "@/hooks/useDealExtraction";

const DEAL_CACHE_KEY = "duodrive_deal_cache";
const SIDE_PANEL_KEY = "duodrive_side_panel_open";
const EXTRACTED_DEAL_KEY = "duodrive_extracted_deal";


export default function DealRoom() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("copilot");
  const [isLoading, setIsLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);
  const [dealEntitlementStatus, setDealEntitlementStatus] = useState<"locked" | "unlocked" | "loading">("loading");
  
  // Use shared chat hook for synced messages across all copilot areas
  const { 
    messages: chatMessages, 
    setMessages: setChatMessages, 
    addMessage, 
    clearMessages,
    refreshWelcome 
  } = useCopilotChat();
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const [dealTextInput, setDealTextInput] = useState("");
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isSmartFilling, setIsSmartFilling] = useState(false);
  const [feeContext, setFeeContext] = useState<FeeContext | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDE_PANEL_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  });
  const { toast } = useToast();

  // Check for dealId and checkout status in URL params
  useEffect(() => {
    const dealId = searchParams.get("dealId");
    const checkoutStatus = searchParams.get("checkout");
    
    if (dealId) {
      setCurrentDealId(dealId);
      
      if (checkoutStatus === "success") {
        toast({
          title: "Payment Successful!",
          description: "Your deal analysis has been unlocked.",
        });
        // Re-check entitlement after successful payment
        checkDealEntitlement(dealId);
      } else if (checkoutStatus === "cancelled") {
        toast({
          title: "Payment Cancelled",
          description: "You can try again when you're ready.",
          variant: "destructive",
        });
      }
    }
  }, [searchParams, toast]);

  // Check deal entitlement when currentDealId changes
  const checkDealEntitlement = async (dealId: string) => {
    setDealEntitlementStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("check-deal-entitlement", {
        body: { dealId },
      });

      if (error) throw error;
      
      setDealEntitlementStatus(data?.status === "unlocked" ? "unlocked" : "locked");
    } catch (error) {
      console.error("Error checking entitlement:", error);
      setDealEntitlementStatus("locked");
    }
  };

  useEffect(() => {
    if (currentDealId) {
      checkDealEntitlement(currentDealId);
    } else {
      // No deal selected - treat as locked (need to save first)
      setDealEntitlementStatus("locked");
    }
  }, [currentDealId]);

  // Persist side panel state
  useEffect(() => {
    try {
      localStorage.setItem(SIDE_PANEL_KEY, String(isSidePanelOpen));
    } catch (e) {
      console.error("Failed to save side panel state:", e);
    }
  }, [isSidePanelOpen]);
  
  // Helper to get input class with extracted highlight
  const getInputClass = (field: string) => 
    extractedFields.has(field) 
      ? "ring-2 ring-green-500 ring-offset-1 bg-green-50 dark:bg-green-950/30 transition-all duration-300" 
      : "";
  
  const [dealData, setDealData] = useState(() => {
    // Load from localStorage on initial render
    try {
      const cached = localStorage.getItem(DEAL_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Failed to load cached deal:", e);
    }
    return {
      year: "",
      make: "",
      model: "",
      trim: "",
      mileage: "",
      vin: "",
      dealerZip: "",
      askingPrice: "",
      negotiatedPrice: "",
      downPayment: "",
      tradeIn: "",
      apr: "",
      term: "60",
      docFee: "",
      dealerFee: "",
      addOns: "",
      taxes: "",
      registration: "",
      buyerZip: "",
      monthlyIncome: "",
      creditScore: "",
      insurance: "",
      fuelCost: "",
      maintenance: "",
      name: "",
    };
  });

  // Save dealData to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(DEAL_CACHE_KEY, JSON.stringify(dealData));
    } catch (e) {
      console.error("Failed to cache deal:", e);
    }
  }, [dealData]);

  // Check for extracted deal data from floating copilot (synced from other pages)
  useEffect(() => {
    try {
      const extractedData = localStorage.getItem(EXTRACTED_DEAL_KEY);
      if (extractedData) {
        const parsed = JSON.parse(extractedData) as ExtractedDealData;
        const fieldNames = getExtractedFieldNames(parsed);
        
        if (fieldNames.length > 0) {
          // Apply extracted data to deal form
          const newExtractedFields = new Set<string>();
          
          setDealData((prev) => {
            const updated = { ...prev };
            Object.entries(parsed).forEach(([key, value]) => {
              if (value !== undefined && value !== null && value !== "") {
                updated[key as keyof typeof prev] = String(value);
                newExtractedFields.add(key);
              }
            });
            return updated;
          });

          setExtractedFields((prev) => new Set([...prev, ...newExtractedFields]));

          toast({
            title: "Deal info synced!",
            description: `Applied ${fieldNames.length} field${fieldNames.length > 1 ? 's' : ''} from your conversation: ${fieldNames.slice(0, 3).join(", ")}${fieldNames.length > 3 ? ` +${fieldNames.length - 3} more` : ""}`,
          });

          // Clear the extracted data after applying
          localStorage.removeItem(EXTRACTED_DEAL_KEY);
        }
      }
    } catch (e) {
      console.error("Failed to sync extracted deal:", e);
    }
  }, []); // Run only on mount

  const handleInputChange = (field: string, value: string) => {
    setDealData((prev) => ({ ...prev, [field]: value }));
    // Clear extracted highlight when user manually edits
    if (extractedFields.has(field)) {
      setExtractedFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, WebP, or PDF file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    toast({
      title: "Extracting...",
      description: "AI is reading your quote. This may take a moment.",
    });

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract quote data");
      }

      const { data: extracted } = await response.json();
      
      if (!extracted) {
        throw new Error("No data extracted from the quote");
      }

      // Track which fields were extracted
      const newExtractedFields = new Set<string>();
      const extractableFields = [
        'year', 'make', 'model', 'trim', 'mileage', 'vin',
        'askingPrice', 'negotiatedPrice', 'downPayment', 'tradeIn', 'apr', 'term',
        'docFee', 'dealerFee', 'addOns', 'taxes', 'registration'
      ];
      
      extractableFields.forEach(field => {
        if (extracted[field]) {
          newExtractedFields.add(field);
        }
      });
      
      setExtractedFields(newExtractedFields);

      // Update form with extracted data
      setDealData((prev) => ({
        ...prev,
        year: extracted.year || prev.year,
        make: extracted.make || prev.make,
        model: extracted.model || prev.model,
        trim: extracted.trim || prev.trim,
        mileage: extracted.mileage || prev.mileage,
        vin: extracted.vin || prev.vin,
        askingPrice: extracted.askingPrice || prev.askingPrice,
        negotiatedPrice: extracted.negotiatedPrice || prev.negotiatedPrice,
        downPayment: extracted.downPayment || prev.downPayment,
        tradeIn: extracted.tradeIn || prev.tradeIn,
        apr: extracted.apr || prev.apr,
        term: extracted.term || prev.term,
        docFee: extracted.docFee || prev.docFee,
        dealerFee: extracted.dealerFee || prev.dealerFee,
        addOns: extracted.addOns || prev.addOns,
        taxes: extracted.taxes || prev.taxes,
        registration: extracted.registration || prev.registration,
      }));

      const fieldsExtracted = newExtractedFields.size;
      toast({
        title: "Quote Extracted!",
        description: `Found ${fieldsExtracted} fields highlighted in green. Please review and fill in any missing details.`,
      });
    } catch (error) {
      console.error("Extraction error:", error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Could not read the quote. Try a clearer image.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      // Reset input so same file can be uploaded again
      event.target.value = '';
    }
  };

  const parseNumber = (value: string): number => {
    return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
  };

  const evaluateDeal = async () => {
    // Validate required fields
    if (!dealData.year || !dealData.make || !dealData.askingPrice || !dealData.monthlyIncome) {
      toast({
        title: "Missing Information",
        description: "Please fill in Year, Make, Asking Price, and Monthly Income at minimum.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Get AI market value estimate
      let estimatedMarketValue: number | undefined;
      
      try {
        const { data: marketData, error: marketError } = await supabase.functions.invoke('estimate-market-value', {
          body: {
            year: parseInt(dealData.year),
            make: dealData.make,
            model: dealData.model || "Unknown",
            trim: dealData.trim || undefined,
            mileage: parseNumber(dealData.mileage) || 50000,
          },
        });
        
        if (!marketError && marketData?.estimatedValue) {
          estimatedMarketValue = marketData.estimatedValue;
          toast({
            title: "Market Value Estimated",
            description: `AI estimates this vehicle at $${estimatedMarketValue.toLocaleString()} (${marketData.confidence} confidence)`,
          });
        }
      } catch (marketErr) {
        console.log("Market estimation failed, using fallback:", marketErr);
      }

      // Step 2: Calculate score using frontend engine
      const input = {
        year: parseInt(dealData.year) || new Date().getFullYear(),
        make: dealData.make,
        model: dealData.model || "Unknown",
        trim: dealData.trim || undefined,
        mileage: parseNumber(dealData.mileage),
        askingPrice: parseNumber(dealData.askingPrice),
        negotiatedPrice: parseNumber(dealData.negotiatedPrice) || undefined,
        downPayment: parseNumber(dealData.downPayment),
        tradeIn: parseNumber(dealData.tradeIn),
        apr: parseNumber(dealData.apr) || 7.0,
        term: parseInt(dealData.term) || 60,
        docFee: parseNumber(dealData.docFee),
        dealerFee: parseNumber(dealData.dealerFee),
        addOns: parseNumber(dealData.addOns),
        taxes: parseNumber(dealData.taxes),
        registration: parseNumber(dealData.registration),
        monthlyIncome: parseNumber(dealData.monthlyIncome),
        creditScore: dealData.creditScore || "fair",
        insurance: parseNumber(dealData.insurance) || 150,
        fuelCost: parseNumber(dealData.fuelCost) || 200,
        maintenance: parseNumber(dealData.maintenance) || 50,
        estimatedMarketValue,
      };

      const result = calculateDuoDriveScore(input);
      
      setScoreResult(result);
      setActiveTab("calculator");
      toast({
        title: "Score Calculated!",
        description: `Your DuoDrive Score is ${result.overall}`,
      });
    } catch (error) {
      console.error('Error calculating score:', error);
      toast({
        title: "Error",
        description: "Failed to calculate score. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply extracted deal data from AI response
  const applyExtractedDealData = (extractedData: ExtractedDealData) => {
    const newExtractedFields = new Set<string>();

    setDealData((prev) => {
      const updated = { ...prev };

      Object.entries(extractedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          updated[key as keyof typeof prev] = String(value);
          newExtractedFields.add(key);
        }
      });

      return updated;
    });

    setExtractedFields((prev) => new Set([...prev, ...newExtractedFields]));

    // Show toast with extracted fields
    const fieldNames = getExtractedFieldNames(extractedData);
    if (fieldNames.length > 0) {
      toast({
        title: "Deal Updated",
        description: `Added ${fieldNames.length} field${fieldNames.length > 1 ? 's' : ''}: ${fieldNames.slice(0, 3).join(", ")}${fieldNames.length > 3 ? ` +${fieldNames.length - 3} more` : ""}`,
      });
    }
  };

  const sendChatMessage = async (directMessage?: string) => {
    const messageToSend = directMessage || chatInput;
    if (!messageToSend.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageToSend };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    let assistantContent = "";

    try {
      const dealContext = {
        year: dealData.year,
        make: dealData.make,
        model: dealData.model,
        trim: dealData.trim,
        mileage: dealData.mileage,
        askingPrice: dealData.askingPrice,
        negotiatedPrice: dealData.negotiatedPrice,
        downPayment: dealData.downPayment,
        tradeIn: dealData.tradeIn,
        apr: dealData.apr,
        term: dealData.term,
        creditScore: dealData.creditScore,
        monthlyIncome: dealData.monthlyIncome,
        insurance: dealData.insurance,
        fuelCost: dealData.fuelCost,
        maintenance: dealData.maintenance,
        scoreResult: scoreResult || undefined,
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          dealContext,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Add empty assistant message
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              // Parse for extracted data and show clean content
              const { cleanContent } = parseExtractedDealData(assistantContent);
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: cleanContent };
                return updated;
              });
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
      }

      // After streaming is complete, extract any deal data from the full response
      const { extractedData } = parseExtractedDealData(assistantContent);
      if (extractedData) {
        applyExtractedDealData(extractedData);
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      // Remove the empty assistant message if error
      if (!assistantContent) {
        setChatMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsChatLoading(false);
    }
  };

  const extractDealFromText = async () => {
    if (!dealTextInput.trim() || isExtractingText) return;

    setIsExtractingText(true);
    toast({
      title: "Understanding your deal...",
      description: "AI is extracting the details. This may take a moment.",
    });

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-deal-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ text: dealTextInput }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract deal data");
      }

      const { data: extracted, extractedCount } = await response.json();

      if (!extracted) {
        throw new Error("No data extracted from the text");
      }

      // Track which fields were extracted
      const newExtractedFields = new Set<string>();
      const extractableFields = [
        'year', 'make', 'model', 'trim', 'mileage', 'vin',
        'askingPrice', 'negotiatedPrice', 'downPayment', 'tradeIn', 'apr', 'term',
        'docFee', 'dealerFee', 'addOns', 'taxes', 'registration', 'monthlyIncome', 'creditScore'
      ];

      extractableFields.forEach(field => {
        if (extracted[field]) {
          newExtractedFields.add(field);
        }
      });

      setExtractedFields(newExtractedFields);

      // Update form with extracted data
      setDealData((prev) => ({
        ...prev,
        year: extracted.year || prev.year,
        make: extracted.make || prev.make,
        model: extracted.model || prev.model,
        trim: extracted.trim || prev.trim,
        mileage: extracted.mileage || prev.mileage,
        vin: extracted.vin || prev.vin,
        askingPrice: extracted.askingPrice || prev.askingPrice,
        negotiatedPrice: extracted.negotiatedPrice || prev.negotiatedPrice,
        downPayment: extracted.downPayment || prev.downPayment,
        tradeIn: extracted.tradeIn || prev.tradeIn,
        apr: extracted.apr || prev.apr,
        term: extracted.term || prev.term,
        docFee: extracted.docFee || prev.docFee,
        dealerFee: extracted.dealerFee || prev.dealerFee,
        addOns: extracted.addOns || prev.addOns,
        taxes: extracted.taxes || prev.taxes,
        registration: extracted.registration || prev.registration,
        monthlyIncome: extracted.monthlyIncome || prev.monthlyIncome,
        creditScore: extracted.creditScore || prev.creditScore,
      }));

      // Clear the text input
      setDealTextInput("");
      
      // Add AI message about what was extracted
      const vehicleInfo = [extracted.year, extracted.make, extracted.model, extracted.trim].filter(Boolean).join(" ");
      const extractedSummary = vehicleInfo 
        ? `I extracted a ${vehicleInfo}` + (extracted.askingPrice ? ` with an asking price of $${parseInt(extracted.askingPrice).toLocaleString()}` : "") + "."
        : "I extracted some deal information.";
      
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `${extractedSummary} I've populated the deal form with ${extractedCount || newExtractedFields.size} fields.\n\nCalculating your DuoDrive Score now...`
      }]);

      toast({
        title: "Deal Extracted!",
        description: `Found ${extractedCount || newExtractedFields.size} fields. Calculating score...`,
      });

      // Auto-calculate score if we have minimum required fields
      const canCalculate = extracted.year && extracted.make && extracted.askingPrice;
      if (canCalculate) {
        // Use extracted data directly for immediate calculation
        setTimeout(async () => {
          try {
            // Get market value estimate first
            let estimatedMarketValue: number | undefined;
            try {
              const { data: marketData, error: marketError } = await supabase.functions.invoke('estimate-market-value', {
                body: {
                  year: parseInt(extracted.year),
                  make: extracted.make,
                  model: extracted.model || "Unknown",
                  trim: extracted.trim || undefined,
                  mileage: parseNumber(extracted.mileage) || 50000,
                },
              });
              if (!marketError && marketData?.estimatedValue) {
                estimatedMarketValue = marketData.estimatedValue;
              }
            } catch (marketErr) {
              console.log("Market estimation failed, using fallback:", marketErr);
            }

            const input = {
              year: parseInt(extracted.year) || new Date().getFullYear(),
              make: extracted.make,
              model: extracted.model || "Unknown",
              trim: extracted.trim || undefined,
              mileage: parseNumber(extracted.mileage),
              askingPrice: parseNumber(extracted.askingPrice),
              negotiatedPrice: parseNumber(extracted.negotiatedPrice) || undefined,
              downPayment: parseNumber(extracted.downPayment),
              tradeIn: parseNumber(extracted.tradeIn),
              apr: parseNumber(extracted.apr) || 7.0,
              term: parseInt(extracted.term) || 60,
              docFee: parseNumber(extracted.docFee),
              dealerFee: parseNumber(extracted.dealerFee),
              addOns: parseNumber(extracted.addOns),
              taxes: parseNumber(extracted.taxes),
              registration: parseNumber(extracted.registration),
              monthlyIncome: parseNumber(extracted.monthlyIncome) || 5000, // Default if not provided
              creditScore: extracted.creditScore || "fair",
              insurance: 150,
              fuelCost: 200,
              maintenance: 50,
              estimatedMarketValue,
            };

            const result = calculateDuoDriveScore(input);
            setScoreResult(result);

            // Update chat with score result
            const scoreMessage = result.overall >= 70 
              ? `Great news! Your DuoDrive Score is **${result.overall}/100** - this looks like a ${result.overall >= 80 ? 'great' : 'decent'} deal!`
              : result.overall >= 50 
              ? `Your DuoDrive Score is **${result.overall}/100** - this deal has some concerns.`
              : `⚠️ Your DuoDrive Score is **${result.overall}/100** - I'd recommend caution with this deal.`;

            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: `${extractedSummary}\n\n${scoreMessage}\n\n**Key findings:**\n• True Market Price: $${result.trueMarketPrice.toLocaleString()}\n• Deal Price Gap: ${result.dealPriceGapPercent >= 0 ? '+' : ''}${result.dealPriceGapPercent}%\n• Monthly Payment: $${result.monthlyPayment.toLocaleString()}\n\n${result.recommendation}\n\nWould you like me to explain any of these numbers or suggest negotiation strategies?`
              };
              return updated;
            });

            toast({
              title: `DuoDrive Score: ${result.overall}`,
              description: result.overall >= 70 ? "This looks like a good deal!" : "Review the analysis for concerns.",
            });
          } catch (scoreError) {
            console.error("Auto-score calculation error:", scoreError);
            setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: `${extractedSummary}\n\nI couldn't auto-calculate the score - you may need to add your monthly income in "The Deal" tab, then click "Calculate Score".`
              };
              return updated;
            });
          }
        }, 100);
      }

    } catch (error) {
      console.error("Text extraction error:", error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Could not understand the deal. Try rephrasing or adding more details.",
        variant: "destructive",
      });
    } finally {
      setIsExtractingText(false);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setDealTextInput(text.trim());
        toast({
          title: "Pasted from clipboard",
          description: "Click 'Extract Deal Info' to analyze.",
        });
        // Auto-extract if text looks like deal info (has numbers)
        if (/\d/.test(text)) {
          // Set the text first, then trigger extraction
          setTimeout(() => {
            extractDealFromText();
          }, 100);
        }
      } else {
        toast({
          title: "Clipboard empty",
          description: "Copy some deal information first, then try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Clipboard access error:", error);
      toast({
        title: "Clipboard access denied",
        description: "Please paste manually using Ctrl+V or Cmd+V.",
        variant: "destructive",
      });
    }
  };

  // Smart Fill - AI suggests reasonable defaults for missing fields
  const smartFillMissingFields = async () => {
    if (isSmartFilling) return;
    
    setIsSmartFilling(true);
    toast({
      title: "Smart Fill",
      description: "AI is suggesting reasonable defaults...",
    });

    try {
      // Build context from existing deal data
      const vehicleInfo = [dealData.year, dealData.make, dealData.model, dealData.trim].filter(Boolean).join(" ");
      const askingPrice = parseNumber(dealData.askingPrice);
      
      const prompt = `Based on this vehicle: ${vehicleInfo || 'unknown vehicle'}${askingPrice ? ` with asking price $${askingPrice.toLocaleString()}` : ''}, suggest reasonable default values for a typical car buyer.

Return ONLY a JSON object with these fields (use null for any you can't reasonably estimate):
{
  "apr": number or null (typical APR percentage for this price range, usually 5-12%),
  "downPayment": number or null (10-20% of asking price is typical),
  "monthlyIncome": number or null (estimate based on vehicle price - someone buying this car likely earns 3-4x annual of car price),
  "insurance": number or null (typical monthly insurance for this vehicle type, $100-300),
  "fuelCost": number or null (typical monthly fuel cost, $150-300),
  "maintenance": number or null (typical monthly maintenance reserve, $50-150),
  "creditScore": string or null ("excellent", "good", "fair", or "poor" - assume "good" if vehicle is reasonably priced)
}

Be conservative and realistic. Only suggest values that make sense for a typical buyer of this vehicle.`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          dealContext: { year: dealData.year, make: dealData.make, model: dealData.model, askingPrice: dealData.askingPrice },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get AI suggestions");
      }

      // Collect the full response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { /* ignore */ }
        }
      }

      // Extract JSON from the response
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse AI suggestions");
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      const newExtractedFields = new Set(extractedFields);
      let fieldsUpdated = 0;

      // Apply suggestions only to empty fields
      setDealData((prev) => {
        const updated = { ...prev };
        
        if (suggestions.apr && !prev.apr) {
          updated.apr = String(suggestions.apr);
          newExtractedFields.add("apr");
          fieldsUpdated++;
        }
        if (suggestions.downPayment && !prev.downPayment) {
          updated.downPayment = String(suggestions.downPayment);
          newExtractedFields.add("downPayment");
          fieldsUpdated++;
        }
        if (suggestions.monthlyIncome && !prev.monthlyIncome) {
          updated.monthlyIncome = String(suggestions.monthlyIncome);
          newExtractedFields.add("monthlyIncome");
          fieldsUpdated++;
        }
        if (suggestions.insurance && !prev.insurance) {
          updated.insurance = String(suggestions.insurance);
          newExtractedFields.add("insurance");
          fieldsUpdated++;
        }
        if (suggestions.fuelCost && !prev.fuelCost) {
          updated.fuelCost = String(suggestions.fuelCost);
          newExtractedFields.add("fuelCost");
          fieldsUpdated++;
        }
        if (suggestions.maintenance && !prev.maintenance) {
          updated.maintenance = String(suggestions.maintenance);
          newExtractedFields.add("maintenance");
          fieldsUpdated++;
        }
        if (suggestions.creditScore && !prev.creditScore) {
          updated.creditScore = suggestions.creditScore;
          newExtractedFields.add("creditScore");
          fieldsUpdated++;
        }
        
        return updated;
      });

      setExtractedFields(newExtractedFields);

      // Add chat message about the suggestions
      if (fieldsUpdated > 0) {
        const suggestionDetails = [];
        if (suggestions.apr) suggestionDetails.push(`APR: ${suggestions.apr}%`);
        if (suggestions.downPayment) suggestionDetails.push(`Down Payment: $${suggestions.downPayment.toLocaleString()}`);
        if (suggestions.monthlyIncome) suggestionDetails.push(`Monthly Income: $${suggestions.monthlyIncome.toLocaleString()}`);
        if (suggestions.insurance) suggestionDetails.push(`Insurance: $${suggestions.insurance}/mo`);
        if (suggestions.fuelCost) suggestionDetails.push(`Fuel: $${suggestions.fuelCost}/mo`);
        if (suggestions.maintenance) suggestionDetails.push(`Maintenance: $${suggestions.maintenance}/mo`);
        if (suggestions.creditScore) suggestionDetails.push(`Credit Score: ${suggestions.creditScore}`);

        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `I've filled in ${fieldsUpdated} fields with reasonable estimates:\n\n• ${suggestionDetails.join('\n• ')}\n\n**These are estimates** based on typical values for this vehicle. You can adjust them in "The Deal" tab if your situation is different.`
        }]);

        toast({
          title: "Smart Fill Complete",
          description: `Filled ${fieldsUpdated} fields with AI suggestions. Green highlights show updated fields.`,
        });
      } else {
        toast({
          title: "No Fields to Fill",
          description: "All relevant fields already have values.",
        });
      }

    } catch (error) {
      console.error("Smart fill error:", error);
      toast({
        title: "Smart Fill Failed",
        description: "Couldn't generate suggestions. Please fill in manually.",
        variant: "destructive",
      });
    } finally {
      setIsSmartFilling(false);
    }
  };

  const handleLoadDeal = (deal: any) => {
    setCurrentDealId(deal.id);
    setDealData({
      year: deal.year || "",
      make: deal.make || "",
      model: deal.model || "",
      trim: deal.trim || "",
      mileage: deal.mileage || "",
      vin: deal.vin || "",
      dealerZip: deal.dealer_zip || "",
      askingPrice: deal.asking_price || "",
      negotiatedPrice: deal.negotiated_price || "",
      downPayment: deal.down_payment || "",
      tradeIn: deal.trade_in || "",
      apr: deal.apr || "",
      term: deal.term || "60",
      docFee: deal.doc_fee || "",
      dealerFee: deal.dealer_fee || "",
      addOns: deal.add_ons || "",
      taxes: deal.taxes || "",
      registration: deal.registration || "",
      buyerZip: deal.buyer_zip || "",
      monthlyIncome: deal.monthly_income || "",
      creditScore: deal.credit_score || "",
      insurance: deal.insurance || "",
      fuelCost: deal.fuel_cost || "",
      maintenance: deal.maintenance || "",
      name: deal.name || "",
    });
    setScoreResult(deal.score_result || null);
    clearMessages();
    setActiveTab("copilot");
  };

  const handleNewDeal = () => {
    setCurrentDealId(null);
    const emptyDeal = {
      year: "",
      make: "",
      model: "",
      trim: "",
      mileage: "",
      vin: "",
      dealerZip: "",
      askingPrice: "",
      negotiatedPrice: "",
      downPayment: "",
      tradeIn: "",
      apr: "",
      term: "60",
      docFee: "",
      dealerFee: "",
      addOns: "",
      taxes: "",
      registration: "",
      buyerZip: "",
      monthlyIncome: "",
      creditScore: "",
      insurance: "",
      fuelCost: "",
      maintenance: "",
      name: "",
    };
    setDealData(emptyDeal);
    setScoreResult(null);
    clearMessages();
    setExtractedFields(new Set());
    setActiveTab("copilot");
    localStorage.removeItem(DEAL_CACHE_KEY);
    toast({ title: "New Deal", description: "Started a fresh deal" });
  };

  // Check if there's any data in the form
  const hasFormData = Object.entries(dealData).some(([key, value]) => 
    key !== "term" && value !== ""
  );

  // Calculate missing fields that would improve score accuracy
  const getMissingFields = () => {
    const missing: { field: string; label: string; importance: 'critical' | 'recommended' | 'optional' }[] = [];
    
    // Critical fields for scoring
    if (!dealData.year) missing.push({ field: 'year', label: 'Year', importance: 'critical' });
    if (!dealData.make) missing.push({ field: 'make', label: 'Make', importance: 'critical' });
    if (!dealData.askingPrice) missing.push({ field: 'askingPrice', label: 'Asking Price', importance: 'critical' });
    if (!dealData.monthlyIncome) missing.push({ field: 'monthlyIncome', label: 'Monthly Income', importance: 'critical' });
    
    // Recommended for better accuracy
    if (!dealData.model) missing.push({ field: 'model', label: 'Model', importance: 'recommended' });
    if (!dealData.mileage) missing.push({ field: 'mileage', label: 'Mileage', importance: 'recommended' });
    if (!dealData.apr) missing.push({ field: 'apr', label: 'APR', importance: 'recommended' });
    if (!dealData.downPayment) missing.push({ field: 'downPayment', label: 'Down Payment', importance: 'recommended' });
    if (!dealData.creditScore) missing.push({ field: 'creditScore', label: 'Credit Score', importance: 'recommended' });
    
    // Optional but helpful
    if (!dealData.trim) missing.push({ field: 'trim', label: 'Trim', importance: 'optional' });
    if (!dealData.docFee && !dealData.dealerFee) missing.push({ field: 'fees', label: 'Fees', importance: 'optional' });
    if (!dealData.taxes) missing.push({ field: 'taxes', label: 'Taxes', importance: 'optional' });
    if (!dealData.insurance) missing.push({ field: 'insurance', label: 'Insurance Cost', importance: 'optional' });
    
    return missing;
  };

  const missingFields = getMissingFields();

  return (
    <Layout>
      <SEO 
        title="Deal Room"
        description="Analyze your car deal with AI-powered insights. Get your DuoDrive Score, identify hidden fees, and learn negotiation strategies."
        canonical="/deal-room"
        keywords="car deal analyzer, car deal review, car buying AI, DuoDrive Score, car price analysis"
      />
      {/* First-visit tutorial overlay */}
      <DealRoomTutorial />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Deal Room</h1>
            <p className="mt-2 text-muted-foreground">
              Send me your deal — I'll break it down for you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!hasFormData}>
                  <FilePlus2 className="h-4 w-4 mr-2" />
                  New Deal
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a New Deal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all current deal data. If you haven't saved this deal, your data will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleNewDeal}>
                    Start New Deal
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <SavedDeals
              dealData={dealData}
              scoreResult={scoreResult}
              onLoadDeal={handleLoadDeal}
              onNewDeal={handleNewDeal}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted rounded-xl">
            <TabsTrigger value="copilot" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Copilot</span>
            </TabsTrigger>
            <TabsTrigger value="deal" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">The Deal</span>
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calculator</span>
            </TabsTrigger>
            <TabsTrigger value="scripts" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg relative">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">What To Say</span>
              {dealEntitlementStatus === "locked" && (
                <span className="flex items-center justify-center h-4 w-4 rounded-full bg-amber-500 text-white ml-1">
                  <Lock className="h-2.5 w-2.5" />
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="overview" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
          </TabsList>

          {/* THE DEAL TAB */}
          <TabsContent value="deal" className="animate-fade-in">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Car Details */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                <h2 className="text-xl font-semibold text-foreground mb-6">Car Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" placeholder="2024" value={dealData.year} onChange={(e) => handleInputChange("year", e.target.value)} className={getInputClass("year")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="make">Make</Label>
                    <Input id="make" placeholder="Honda" value={dealData.make} onChange={(e) => handleInputChange("make", e.target.value)} className={getInputClass("make")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" placeholder="Accord" value={dealData.model} onChange={(e) => handleInputChange("model", e.target.value)} className={getInputClass("model")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trim">Trim</Label>
                    <Input id="trim" placeholder="EX-L" value={dealData.trim} onChange={(e) => handleInputChange("trim", e.target.value)} className={getInputClass("trim")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mileage">Mileage</Label>
                    <Input id="mileage" placeholder="15,000" value={dealData.mileage} onChange={(e) => handleInputChange("mileage", e.target.value)} className={getInputClass("mileage")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vin">VIN</Label>
                    <Input id="vin" placeholder="Optional" value={dealData.vin} onChange={(e) => handleInputChange("vin", e.target.value)} className={getInputClass("vin")} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="dealerZip">Dealer ZIP</Label>
                    <Input id="dealerZip" placeholder="90210" value={dealData.dealerZip} onChange={(e) => handleInputChange("dealerZip", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Pricing Details */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                <h2 className="text-xl font-semibold text-foreground mb-6">Pricing Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="askingPrice">Asking Price</Label>
                    <Input id="askingPrice" placeholder="$32,000" value={dealData.askingPrice} onChange={(e) => handleInputChange("askingPrice", e.target.value)} className={getInputClass("askingPrice")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="negotiatedPrice">Negotiated Price</Label>
                    <Input id="negotiatedPrice" placeholder="Optional" value={dealData.negotiatedPrice} onChange={(e) => handleInputChange("negotiatedPrice", e.target.value)} className={getInputClass("negotiatedPrice")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="downPayment">Down Payment</Label>
                    <Input id="downPayment" placeholder="$5,000" value={dealData.downPayment} onChange={(e) => handleInputChange("downPayment", e.target.value)} className={getInputClass("downPayment")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tradeIn">Trade-In Value</Label>
                    <Input id="tradeIn" placeholder="$8,000" value={dealData.tradeIn} onChange={(e) => handleInputChange("tradeIn", e.target.value)} className={getInputClass("tradeIn")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apr">APR (%)</Label>
                    <Input id="apr" placeholder="6.5" value={dealData.apr} onChange={(e) => handleInputChange("apr", e.target.value)} className={getInputClass("apr")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="term">Term (months)</Label>
                    <Select value={dealData.term} onValueChange={(value) => handleInputChange("term", value)}>
                      <SelectTrigger className={getInputClass("term")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                        <SelectItem value="72">72 months</SelectItem>
                        <SelectItem value="84">84 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Fees */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                <h2 className="text-xl font-semibold text-foreground mb-6">Fees & Taxes</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="docFee">Doc Fee</Label>
                    <Input id="docFee" placeholder="$499" value={dealData.docFee} onChange={(e) => handleInputChange("docFee", e.target.value)} className={getInputClass("docFee")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealerFee">Dealer Fee</Label>
                    <Input id="dealerFee" placeholder="$0" value={dealData.dealerFee} onChange={(e) => handleInputChange("dealerFee", e.target.value)} className={getInputClass("dealerFee")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addOns">Add-Ons</Label>
                    <Input id="addOns" placeholder="$0" value={dealData.addOns} onChange={(e) => handleInputChange("addOns", e.target.value)} className={getInputClass("addOns")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxes">Est. Taxes</Label>
                    <Input id="taxes" placeholder="$2,400" value={dealData.taxes} onChange={(e) => handleInputChange("taxes", e.target.value)} className={getInputClass("taxes")} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="registration">Registration</Label>
                    <Input id="registration" placeholder="$350" value={dealData.registration} onChange={(e) => handleInputChange("registration", e.target.value)} className={getInputClass("registration")} />
                  </div>
                </div>
              </div>

              {/* Buyer Profile */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                <h2 className="text-xl font-semibold text-foreground mb-6">Your Profile</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buyerZip">Your ZIP</Label>
                    <Input id="buyerZip" placeholder="90210" value={dealData.buyerZip} onChange={(e) => handleInputChange("buyerZip", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthlyIncome">Monthly Income</Label>
                    <Input id="monthlyIncome" placeholder="$5,000" value={dealData.monthlyIncome} onChange={(e) => handleInputChange("monthlyIncome", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditScore">Credit Score Range</Label>
                    <Select value={dealData.creditScore} onValueChange={(value) => handleInputChange("creditScore", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent (750+)</SelectItem>
                        <SelectItem value="good">Good (700-749)</SelectItem>
                        <SelectItem value="fair">Fair (650-699)</SelectItem>
                        <SelectItem value="poor">Poor (below 650)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="insurance">Monthly Insurance</Label>
                    <Input id="insurance" placeholder="$150" value={dealData.insurance} onChange={(e) => handleInputChange("insurance", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuelCost">Monthly Fuel</Label>
                    <Input id="fuelCost" placeholder="$200" value={dealData.fuelCost} onChange={(e) => handleInputChange("fuelCost", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance">Monthly Maintenance</Label>
                    <Input id="maintenance" placeholder="$50" value={dealData.maintenance} onChange={(e) => handleInputChange("maintenance", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Pricing Confidence */}
              <div className="lg:col-span-2">
                <PricingConfidence dealData={dealData} />
              </div>

              {/* Upload Section */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border shadow-card">
                <h2 className="text-xl font-semibold text-foreground mb-4">Or Upload a Quote</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Take a photo of a sticker price or upload a dealer's quote — our AI will extract the numbers for you.
                </p>
                
                {isExtracting ? (
                  <div className="border-2 border-primary bg-primary/5 rounded-xl p-8 text-center">
                    <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-foreground font-medium">
                      Extracting deal details...
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      AI is reading your quote
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Camera Capture - triggers device camera directly */}
                    <label className="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Camera className="h-8 w-8 text-primary mb-3" />
                      <p className="text-sm font-medium text-foreground">Take Photo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use your camera
                      </p>
                    </label>

                    {/* Photo Library - opens gallery/photos */}
                    <label className="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <ImagePlus className="h-8 w-8 text-primary mb-3" />
                      <p className="text-sm font-medium text-foreground">Choose Photo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        From your gallery
                      </p>
                    </label>

                    {/* File Upload - for PDFs and other documents */}
                    <label className="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground">Upload File</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF or image
                      </p>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={evaluateDeal} size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  "Evaluate My Deal"
                )}
              </Button>
            </div>
          </TabsContent>

          {/* CALCULATOR TAB */}
          <TabsContent value="calculator" className="animate-fade-in">
            {!scoreResult ? (
              <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-card border border-border shadow-card text-center">
                <Calculator className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No Analysis Yet</h2>
                <p className="text-muted-foreground mb-6">
                  Fill in your deal details and click "Evaluate My Deal" to see the full analysis.
                </p>
                <Button onClick={() => setActiveTab("deal")}>Enter Deal Details</Button>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Learn More Section */}
                <details className="group p-5 rounded-2xl bg-accent/50 border border-primary/20">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">How is the DuoDrive Score calculated?</h3>
                        <p className="text-sm text-muted-foreground">Learn what goes into your score</p>
                      </div>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-open:rotate-180 transition-transform">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <p className="text-sm text-muted-foreground">
                      The DuoDrive Score (0-100) evaluates your car deal across five weighted pillars to give you a complete picture of whether it's a good buy:
                    </p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingDown className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-foreground">Depreciation (20%)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">How much value the car has already lost and will continue to lose</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-medium text-foreground">Reliability (20%)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Historical reliability of the make and expected repair costs</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-foreground">Safety (15%)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Safety ratings and modern safety features for the vehicle</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium text-foreground">Deal Health (25%)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Price vs market value, fees, APR relative to your credit score</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Heart className="h-4 w-4 text-pink-500" />
                          <span className="text-sm font-medium text-foreground">Affordability (20%)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">How well the car fits your budget and income level</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium text-foreground">Key Metrics</span>
                        </div>
                        <p className="text-xs text-muted-foreground">DPG, CFG, CMSP, and payment burden calculations</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/glossary">
                          <BookOpen className="h-4 w-4 mr-2" />
                          View Full Glossary
                        </Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Tap any <span className="inline-flex items-center"><HelpCircle className="h-3 w-3 mx-0.5" /></span> icon for quick definitions
                      </p>
                    </div>
                  </div>
                </details>

                {/* Fairness Meter */}
                <div className="p-6 rounded-2xl bg-card border border-border shadow-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Deal Fairness Meter</h2>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      scoreResult.pillars.dealHealth.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      scoreResult.pillars.dealHealth.score >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      scoreResult.pillars.dealHealth.score >= 40 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {scoreResult.pillars.dealHealth.score >= 80 ? <CheckCircle2 className="h-4 w-4" /> :
                       scoreResult.pillars.dealHealth.score >= 40 ? <AlertTriangle className="h-4 w-4" /> :
                       <XCircle className="h-4 w-4" />}
                      {getDealHealthLabel(scoreResult.pillars.dealHealth.score)}
                    </div>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={scoreResult.pillars.dealHealth.score} 
                      className="h-4 rounded-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Overpriced</span>
                      <span>Needs Work</span>
                      <span>Fair</span>
                      <span>Great Deal</span>
                    </div>
                  </div>
                </div>

                {/* V3 Metrics Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* True Market Price */}
                  <div className="p-5 rounded-xl bg-card border border-border shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">True Market Price (TMP)</p>
                        <p className="text-2xl font-bold text-foreground">${scoreResult.trueMarketPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">AI-estimated fair value based on year, make, model, and mileage</p>
                  </div>

                  {/* Deal Price Gap */}
                  <div className="p-5 rounded-xl bg-card border border-border shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        scoreResult.dealPriceGapPercent <= 0 ? 'bg-green-100 dark:bg-green-900/30' :
                        scoreResult.dealPriceGapPercent <= 10 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <TrendingUp className={`h-5 w-5 ${
                          scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.dealPriceGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center">
                          Deal Price Gap (DPG)
                          <TermTooltip 
                            term="Deal Price Gap (DPG)" 
                            definition="The difference between the asking price and the estimated true market value. A negative gap means you're getting a deal; a positive gap means you're paying above market value."
                          />
                        </p>
                        <p className={`text-2xl font-bold ${
                          scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.dealPriceGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {scoreResult.dealPriceGap >= 0 ? '+' : ''}${scoreResult.dealPriceGap.toLocaleString()} ({scoreResult.dealPriceGapPercent}%)
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scoreResult.dealPriceGapPercent <= 0 ? 'Great! Price is at or below market value.' :
                       scoreResult.dealPriceGapPercent <= 10 ? 'Fair price, close to market value.' :
                       scoreResult.dealPriceGapPercent <= 20 ? 'Overpriced. Try to negotiate down.' :
                       'Significantly overpriced. Consider walking away.'}
                    </p>
                  </div>

                  {/* Customer Max Safe Price */}
                  <div className="p-5 rounded-xl bg-card border border-border shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center">
                          Your Safe Max Price (CMSP)
                          <TermTooltip 
                            term="Customer Max Safe Price (CMSP)" 
                            definition="The maximum vehicle price you can safely afford based on your monthly income. Calculated using the 12% rule: your monthly car payment should not exceed 12% of your gross monthly income."
                          />
                        </p>
                        <p className="text-2xl font-bold text-foreground">${scoreResult.customerMaxSafePrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Based on 12% of your income rule for monthly payment</p>
                  </div>

                  {/* Customer Fit Gap */}
                  <div className="p-5 rounded-xl bg-card border border-border shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        scoreResult.customerFitGapPercent <= 0 ? 'bg-green-100 dark:bg-green-900/30' :
                        scoreResult.customerFitGapPercent <= 10 ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        scoreResult.customerFitGapPercent <= 25 ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <Heart className={`h-5 w-5 ${
                          scoreResult.customerFitGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.customerFitGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.customerFitGapPercent <= 25 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground flex items-center">
                          Budget Fit Gap (CFG)
                          <TermTooltip 
                            term="Customer Fit Gap (CFG)" 
                            definition="The difference between the asking price and what you can safely afford (CMSP). A negative gap means you're within budget; a positive gap shows how much the car exceeds your safe spending limit."
                          />
                        </p>
                        <p className={`text-2xl font-bold ${
                          scoreResult.customerFitGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.customerFitGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.customerFitGapPercent <= 25 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {scoreResult.customerFitGap >= 0 ? '+' : ''}${scoreResult.customerFitGap.toLocaleString()} ({scoreResult.customerFitGapPercent}%)
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scoreResult.customerFitGapPercent <= 0 ? 'Fits within your safe budget!' :
                       scoreResult.customerFitGapPercent <= 10 ? 'Slightly above safe range.' :
                       scoreResult.customerFitGapPercent <= 25 ? 'Risky stretch for your budget.' :
                       'Far above what you can safely afford.'}
                    </p>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Loan & Payment Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">${scoreResult.monthlyPayment.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">${scoreResult.loanAmount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Loan Amount</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">${scoreResult.totalInterest.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total Interest</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{scoreResult.interestRatio}%</p>
                      <p className="text-sm text-muted-foreground flex items-center justify-center">
                        Interest Ratio
                        <TermTooltip 
                          term="Interest Ratio" 
                          definition="The percentage of your total loan payments that goes toward interest rather than principal. A higher ratio means you're paying more for the privilege of borrowing."
                        />
                      </p>
                    </div>
                  </div>
                </div>

                {/* Monthly Burden Analysis */}
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Cost Burden</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground flex items-center">
                          Payment Burden
                          <TermTooltip 
                            term="Payment Burden" 
                            definition="The percentage of your monthly income that goes toward your car payment. Financial experts recommend keeping this under 12% to maintain healthy finances."
                          />
                        </span>
                        <span className={`text-lg font-bold ${
                          scoreResult.paymentBurdenPercent <= 10 ? 'text-green-600' :
                          scoreResult.paymentBurdenPercent <= 15 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{scoreResult.paymentBurdenPercent}%</span>
                      </div>
                      <Progress value={Math.min(scoreResult.paymentBurdenPercent * 4, 100)} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Target: under 12% of income</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground flex items-center">
                          Total Operating Cost
                          <TermTooltip 
                            term="Total Operating Cost" 
                            definition="The total percentage of your monthly income spent on all car-related expenses: payment, insurance, fuel, and maintenance. Financial experts recommend keeping this under 20% of your income."
                          />
                        </span>
                        <span className={`text-lg font-bold ${
                          scoreResult.operatingCostBurden <= 15 ? 'text-green-600' :
                          scoreResult.operatingCostBurden <= 20 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>{scoreResult.operatingCostBurden}%</span>
                      </div>
                      <Progress value={Math.min(scoreResult.operatingCostBurden * 3.3, 100)} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Target: under 20% of income</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Monthly Cost</span>
                        <span className="text-lg font-bold text-foreground">${scoreResult.totalMonthlyCost.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">Payment + insurance + fuel + maintenance</p>
                    </div>
                  </div>
                </div>

                {/* Fee Breakdown Analysis */}
                <FeeBreakdown
                  docFee={parseNumber(dealData.docFee)}
                  dealerFee={parseNumber(dealData.dealerFee)}
                  addOns={parseNumber(dealData.addOns)}
                  taxes={parseNumber(dealData.taxes)}
                  registration={parseNumber(dealData.registration)}
                  askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice) || 25000}
                />

                {/* View Full Score Button */}
                <div className="text-center">
                  <Button onClick={() => setActiveTab("overview")} size="lg">
                    View Full Score Breakdown
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* AI COPILOT TAB - PRIMARY ENTRY POINT */}
          <TabsContent value="copilot" className="animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Hero Section */}
              <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/30 to-primary/5 border border-primary/20">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <Sparkles className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                  Send me your deal — I'll break it down
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Paste your dealer quote, type the numbers, or upload a screenshot. I'll extract everything and tell you if it's a good deal.
                </p>
              </div>

              {/* Deal Input Area - show when no user messages yet */}
              {chatMessages.filter(m => m.role === 'user').length === 0 && !hasFormData && (
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Type or paste your deal information</h3>
                  </div>
                  <Textarea
                    placeholder={`Type or paste your deal information here — dealer quote, text message, email, notes, etc.

Example:
2017 Camry SE, 82k miles
Price $17,900, down payment $500
APR 11.9%, 60 months
TTL & fees $2,800`}
                    className="min-h-[160px] mb-4 resize-none"
                    value={dealTextInput}
                    onChange={(e) => setDealTextInput(e.target.value)}
                    disabled={isExtractingText}
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={extractDealFromText} 
                      disabled={!dealTextInput.trim() || isExtractingText}
                      className="flex-1"
                      size="lg"
                    >
                      {isExtractingText ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Understanding your deal...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Extract Deal Info
                        </>
                      )}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={pasteFromClipboard}
                        disabled={isExtractingText}
                        className="h-11"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Paste</span>
                      </Button>
                      <Label htmlFor="file-upload-copilot" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 h-11 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                          <ImagePlus className="h-4 w-4" />
                          <span className="hidden sm:inline">Image</span>
                        </div>
                        <Input
                          id="file-upload-copilot"
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isExtracting}
                        />
                      </Label>
                      <Label htmlFor="camera-capture-copilot" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 h-11 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                          <Camera className="h-4 w-4" />
                          <span className="hidden sm:inline">Camera</span>
                        </div>
                        <Input
                          id="camera-capture-copilot"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isExtracting}
                        />
                      </Label>
                    </div>
                  </div>
                  {isExtracting && (
                    <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Extracting from image...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions when deal data exists */}
              {hasFormData && chatMessages.filter(m => m.role === 'user').length === 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <Bot className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">I see you have a deal in progress</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {dealData.year && dealData.make && (
                      <>Looking at a {dealData.year} {dealData.make} {dealData.model || ''} {dealData.askingPrice && `for ${dealData.askingPrice.startsWith('$') ? dealData.askingPrice : `$${parseInt(dealData.askingPrice).toLocaleString()}`}`}. </>
                    )}
                    What would you like to do?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setChatMessages([{ role: 'user', content: 'Calculate my DuoDrive Score and tell me if this is a good deal.' }]);
                        evaluateDeal();
                      }}
                      disabled={isLoading}
                      className="justify-start"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Calculate DuoDrive Score
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("deal")}
                      className="justify-start"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Review/Edit Deal Details
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const msg = "What should I look out for in this deal? Are there any red flags?";
                        setChatInput(msg);
                        setTimeout(() => sendChatMessage(), 100);
                      }}
                      className="justify-start"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Check for Red Flags
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const msg = "Give me a negotiation script to get a better price on this deal.";
                        setChatInput(msg);
                        setTimeout(() => sendChatMessage(), 100);
                      }}
                      className="justify-start"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Get Negotiation Script
                    </Button>
                  </div>
                </div>
              )}

              {/* What's Missing Indicator */}
              {hasFormData && missingFields.length > 0 && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <h4 className="text-sm font-medium text-foreground">What's missing?</h4>
                      <span className="text-xs text-muted-foreground hidden sm:inline">Adding these improves accuracy</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={smartFillMissingFields}
                      disabled={isSmartFilling}
                      className="h-8"
                    >
                      {isSmartFilling ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                          Filling...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3 w-3 mr-1.5" />
                          Smart Fill
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {missingFields.filter(f => f.importance === 'critical').map(f => (
                      <button
                        key={f.field}
                        onClick={() => setActiveTab("deal")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <XCircle className="h-3 w-3" />
                        {f.label}
                      </button>
                    ))}
                    {missingFields.filter(f => f.importance === 'recommended').map(f => (
                      <button
                        key={f.field}
                        onClick={() => setActiveTab("deal")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                      >
                        {f.label}
                      </button>
                    ))}
                    {missingFields.filter(f => f.importance === 'optional').slice(0, 3).map(f => (
                      <button
                        key={f.field}
                        onClick={() => setActiveTab("deal")}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-accent transition-colors"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {missingFields.filter(f => f.importance === 'critical').length > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      Red items are required for accurate scoring
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Click "Smart Fill" to let AI suggest reasonable defaults based on your vehicle
                  </p>
                </div>
              )}

              {/* Chat Messages */}
              {chatMessages.filter(m => m.role === 'user').length > 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Conversation</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearMessages}
                      className="h-8 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl ${
                          msg.role === 'user' 
                            ? 'bg-primary/10 ml-8' 
                            : 'bg-muted mr-8'
                        }`}
                      >
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {msg.role === 'user' ? 'You' : 'AI Copilot'}
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                    {isChatLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Input 
                      placeholder="Type or paste your deal information..." 
                      className="flex-1" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                      disabled={isChatLoading}
                    />
                    <Button onClick={() => sendChatMessage()} disabled={isChatLoading || !chatInput.trim()}>
                      {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {scoreResult && (
                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${getDealHealthColor(scoreResult.overall).replace('text-', 'bg-')}`} />
                        <span className="text-sm text-muted-foreground">DuoDrive Score: <strong className="text-foreground">{scoreResult.overall}</strong></span>
                      </div>
                      <Button variant="link" size="sm" onClick={() => setActiveTab("overview")} className="text-primary">
                        View Full Analysis <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Input area when deal exists but no user chat messages */}
              {(hasFormData || chatMessages.filter(m => m.role === 'user').length > 0) && chatMessages.filter(m => m.role === 'user').length === 0 && (
                <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Type or paste your deal information..." 
                      className="flex-1" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                      disabled={isChatLoading}
                    />
                    <Button onClick={() => sendChatMessage()} disabled={isChatLoading || !chatInput.trim()}>
                      {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Bottom tips */}
              <div className="text-center text-xs text-muted-foreground">
                <p>I can read dealer quotes, text messages, emails, bullet points, or any format. Just paste it!</p>
              </div>
            </div>
          </TabsContent>

          {/* WHAT TO SAY NEXT TAB */}
          <TabsContent value="scripts" className="animate-fade-in">
            <div className="max-w-4xl mx-auto py-4 space-y-6">
              {dealEntitlementStatus === "loading" ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dealEntitlementStatus === "locked" ? (
                <DealAnalysisPaywall 
                  dealId={currentDealId || ""} 
                  dealName={dealData.name || `${dealData.year} ${dealData.make} ${dealData.model}`.trim() || undefined}
                  onUnlocked={() => {
                    if (currentDealId) checkDealEntitlement(currentDealId);
                  }}
                />
              ) : (
                <>
                  {/* Fee Breakdown for context */}
                  <FeeBreakdown
                    docFee={parseNumber(dealData.docFee)}
                    dealerFee={parseNumber(dealData.dealerFee)}
                    addOns={parseNumber(dealData.addOns)}
                    taxes={parseNumber(dealData.taxes)}
                    registration={parseNumber(dealData.registration)}
                    askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice) || 25000}
                    onFeeContextChange={setFeeContext}
                  />
                  
                  {/* Negotiation Scripts */}
                  <WhatToSayNext 
                    dealData={dealData} 
                    scoreResult={scoreResult}
                    feeContext={feeContext || undefined}
                  />
                </>
              )}
            </div>
          </TabsContent>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="animate-fade-in">
            {!scoreResult ? (
              <div className="text-center py-16">
                <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No Score Yet</h2>
                <p className="text-muted-foreground mb-6">
                  Fill in your deal details and click "Evaluate My Deal" to see your score.
                </p>
                <Button onClick={() => setActiveTab("deal")}>Enter Deal Details</Button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Score */}
                <div className="lg:col-span-1 p-8 rounded-2xl bg-card border border-border shadow-elevated flex flex-col items-center justify-center">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Your DuoDrive Score</h2>
                  <ScoreRing score={scoreResult.overall} size="xl" />
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Based on the data you provided
                  </p>
                </div>

                {/* Pillars Grid */}
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-semibold text-foreground mb-6">Score Breakdown</h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <PillarCard
                      icon={TrendingDown}
                      title="Depreciation"
                      description={scoreResult.pillars.depreciation.details}
                      score={scoreResult.pillars.depreciation.score}
                    />
                    <PillarCard
                      icon={Wrench}
                      title="Reliability"
                      description={scoreResult.pillars.reliability.details}
                      score={scoreResult.pillars.reliability.score}
                    />
                    <PillarCard
                      icon={Shield}
                      title="Safety"
                      description={scoreResult.pillars.safety.details}
                      score={scoreResult.pillars.safety.score}
                    />
                    <PillarCard
                      icon={DollarSign}
                      title="Deal Health"
                      description={scoreResult.pillars.dealHealth.details}
                      score={scoreResult.pillars.dealHealth.score}
                    />
                    <PillarCard
                      icon={Heart}
                      title="Affordability"
                      description={scoreResult.pillars.affordability.details}
                      score={scoreResult.pillars.affordability.score}
                    />
                  </div>
                </div>

                {/* V3 Market & Budget Analysis */}
                <div className="lg:col-span-3 p-6 rounded-2xl bg-card border border-border shadow-card">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Market & Budget Analysis</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* True Market Price */}
                    <div className={`p-4 rounded-xl border-2 ${
                      scoreResult.dealPriceGapPercent <= 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
                      scoreResult.dealPriceGapPercent <= 5 ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20' :
                      scoreResult.dealPriceGapPercent <= 10 ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' :
                      'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className={`h-5 w-5 ${
                          scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.dealPriceGapPercent <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.dealPriceGapPercent <= 10 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                        <span className="text-xs font-medium text-muted-foreground flex items-center">
                          TMP
                          <TermTooltip 
                            term="True Market Price (TMP)" 
                            definition="The estimated fair market value of a vehicle based on its year, mileage, condition, and comparable sales data. This is what the car is actually worth, not what the dealer is asking."
                          />
                        </span>
                      </div>
                      <p className="text-xl font-bold text-foreground">${scoreResult.trueMarketPrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">True Market Price</p>
                    </div>

                    {/* Deal Price Gap */}
                    <div className={`p-4 rounded-xl border-2 ${
                      scoreResult.dealPriceGapPercent <= 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
                      scoreResult.dealPriceGapPercent <= 5 ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20' :
                      scoreResult.dealPriceGapPercent <= 10 ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' :
                      'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={`h-5 w-5 ${
                          scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.dealPriceGapPercent <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.dealPriceGapPercent <= 10 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                        <span className="text-xs font-medium text-muted-foreground flex items-center">
                          DPG
                          <TermTooltip 
                            term="Deal Price Gap (DPG)" 
                            definition="The difference between the asking price and the estimated true market value. A negative gap means you're getting a deal; a positive gap means you're paying above market value."
                          />
                        </span>
                      </div>
                      <p className={`text-xl font-bold ${
                        scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                        scoreResult.dealPriceGapPercent <= 5 ? 'text-yellow-600 dark:text-yellow-400' :
                        scoreResult.dealPriceGapPercent <= 10 ? 'text-orange-600 dark:text-orange-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {scoreResult.dealPriceGap >= 0 ? '+' : ''}${scoreResult.dealPriceGap.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Deal Price Gap ({scoreResult.dealPriceGapPercent}%)</p>
                    </div>

                    {/* Customer Max Safe Price */}
                    <div className={`p-4 rounded-xl border-2 ${
                      scoreResult.customerFitGapPercent <= 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
                      scoreResult.customerFitGapPercent <= 10 ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20' :
                      scoreResult.customerFitGapPercent <= 25 ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' :
                      'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className={`h-5 w-5 ${
                          scoreResult.customerFitGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.customerFitGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.customerFitGapPercent <= 25 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                        <span className="text-xs font-medium text-muted-foreground flex items-center">
                          CMSP
                          <TermTooltip 
                            term="Customer Max Safe Price (CMSP)" 
                            definition="The maximum vehicle price you can safely afford based on your monthly income. Calculated using the 12% rule: your monthly car payment should not exceed 12% of your gross monthly income."
                          />
                        </span>
                      </div>
                      <p className="text-xl font-bold text-foreground">${scoreResult.customerMaxSafePrice.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">Max Safe Price</p>
                    </div>

                    {/* Customer Fit Gap */}
                    <div className={`p-4 rounded-xl border-2 ${
                      scoreResult.customerFitGapPercent <= 0 ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20' :
                      scoreResult.customerFitGapPercent <= 10 ? 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20' :
                      scoreResult.customerFitGapPercent <= 25 ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20' :
                      'border-red-500/50 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className={`h-5 w-5 ${
                          scoreResult.customerFitGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.customerFitGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          scoreResult.customerFitGapPercent <= 25 ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`} />
                        <span className="text-xs font-medium text-muted-foreground flex items-center">
                          CFG
                          <TermTooltip 
                            term="Customer Fit Gap (CFG)" 
                            definition="The difference between the asking price and what you can safely afford (CMSP). A negative gap means you're within budget; a positive gap shows how much the car exceeds your safe spending limit."
                          />
                        </span>
                      </div>
                      <p className={`text-xl font-bold ${
                        scoreResult.customerFitGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                        scoreResult.customerFitGapPercent <= 10 ? 'text-yellow-600 dark:text-yellow-400' :
                        scoreResult.customerFitGapPercent <= 25 ? 'text-orange-600 dark:text-orange-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {scoreResult.customerFitGap >= 0 ? '+' : ''}${scoreResult.customerFitGap.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Budget Fit Gap ({scoreResult.customerFitGapPercent}%)</p>
                    </div>
                  </div>
                </div>

                {/* Deal Summary */}
                <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border shadow-card">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Deal Summary</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">${scoreResult.monthlyPayment.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{dealData.apr || "7.0"}%</p>
                      <p className="text-sm text-muted-foreground">APR</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">${(scoreResult.totalCost / 1000).toFixed(0)}K</p>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{dealData.term}</p>
                      <p className="text-sm text-muted-foreground">Months</p>
                    </div>
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="lg:col-span-1 p-6 rounded-2xl bg-accent border border-primary/20 shadow-card">
                  <div className="flex items-center gap-3 mb-4">
                    <Bot className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">AI Recommendation</h2>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {scoreResult.recommendation}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => generateScoreReport(scoreResult, dealData)} 
                      variant="outline" 
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <EmailShareDialog 
                      scoreResult={scoreResult} 
                      dealData={dealData}
                      trigger={
                        <Button variant="outline" className="flex-1">
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Get Scripts CTA */}
                <div className="lg:col-span-3 p-6 rounded-2xl bg-muted/50 border border-border">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Negotiate?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get dealer-ready scripts to negotiate price, remove fees, or walk away with confidence.
                    </p>
                    <Button onClick={() => setActiveTab("scripts")}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      What To Say Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Side Panel AI Copilot - visible on non-copilot tabs */}
      {activeTab !== "copilot" && (
        <DealRoomCopilot
          messages={chatMessages.map((msg, idx) => ({
            role: msg.role,
            content: msg.content
          }))}
          onSendMessage={(msg) => sendChatMessage(msg)}
          onClearMessages={clearMessages}
          isLoading={isChatLoading}
          isOpen={isSidePanelOpen}
          onToggle={() => setIsSidePanelOpen(!isSidePanelOpen)}
          dealContext={{
            year: dealData.year,
            make: dealData.make,
            model: dealData.model,
            askingPrice: dealData.askingPrice
          }}
        />
      )}
    </Layout>
  );
}
