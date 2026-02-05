import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { ConversationCanvas } from "@/components/ConversationCanvas";
import { DealRoomTutorial } from "@/components/DealRoomTutorial";
import DealAnalysisPaywall from "@/components/DealAnalysisPaywall";
import { EstimateAprModal, CreditTier, VehicleCondition, LoanTerm } from "@/components/EstimateAprModal";
import { HowToUseQuinn } from "@/components/HowToUseQuinn";
import { VinBadge, getFieldSource } from "@/components/VinBadge";
import { SignInPrompt } from "@/components/SignInPrompt";
import { NegotiationConfidenceMeter } from "@/components/NegotiationConfidenceMeter";
import { PremiumDecisionModal } from "@/components/PremiumDecisionModal";
import { PostPurchaseConfirmation } from "@/components/PostPurchaseConfirmation";
import { Upload, Calculator, Bot, BookOpen, BarChart3, TrendingDown, Wrench, Shield, DollarSign, Heart, Loader2, FileCheck, Camera, ImagePlus, FilePlus2, TrendingUp, Target, AlertTriangle, CheckCircle2, XCircle, Wallet, Download, Mail, Sparkles, Send, FileText, ArrowRight, Clipboard, Wand2, RotateCcw, HelpCircle, MessageSquare, MessageCircle, Lock, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { WhatToSayNext, FeeContext } from "@/components/WhatToSayNext";

import { FeeBreakdown } from "@/components/FeeBreakdown";
import { TermTooltip } from "@/components/TermTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCopilotChat, ChatMessage } from "@/hooks/useCopilotChat";
import { useNegotiationConfidence } from "@/hooks/useNegotiationConfidence";
import { calculateDuoDriveScore, getDealHealthColor, getDealHealthLabel, ScoreResult, AffordabilityStatus } from "@/lib/duodriveScore";
import { analyzeAffordability, isLuxuryBrand } from "@/lib/affordabilityRules";
import { AffordabilityWarning } from "@/components/AffordabilityWarning";
import {
  MarketReferenceCard,
  PricingPositionCard,
  BudgetComfortCard,
  MonthlyRealityCard,
  DealerAddOnsCard,
  WhyThisMattersCard,
} from "@/components/dealroom";
import { Progress } from "@/components/ui/progress";
import { generateScoreReport } from "@/lib/pdfExport";
import { EmailShareDialog } from "@/components/EmailShareDialog";
import { parseExtractedDealData, getExtractedFieldNames, ExtractedDealData } from "@/hooks/useDealExtraction";
import { extractVin, decodeVinWithNhtsa, mapNhtsaToDealContext, isValidVin } from "@/lib/vinUtils";
import { useQuinnBroadcastMain, openQuinnPopout } from "@/hooks/useQuinnBroadcast";
import { estimateInsurance } from "@/lib/insuranceEstimator";
 import { extractVehicleInfo } from "@/lib/vehicle/normalizeMake";
 import { resolveMakeFromUserText, formatMakeOptions, MakeResolution } from "@/lib/vehicle/makeResolver";
import { FEATURES } from "@/config/features";
import { useIdlePing } from "@/hooks/useIdlePing";
import { useDealAutosave } from "@/hooks/useDealAutosave";
import { useMilestoneNudges } from "@/hooks/useMilestoneNudges";

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
  
  // Dealership mode state
  const isMobile = useIsMobile();
  const [isDealershipMode, setIsDealershipMode] = useState(false);
  const [atDealership, setAtDealership] = useState<boolean | null>(null);
  const [showDealershipCheck, setShowDealershipCheck] = useState(false);
  
  // Use shared chat hook for synced messages across all copilot areas
  const { 
    messages: chatMessages, 
    setMessages: setChatMessages, 
    addMessage, 
    clearMessages,
    refreshWelcome,
    markFirstMessageAnimated
  } = useCopilotChat();
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const [dealTextInput, setDealTextInput] = useState("");
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [isSmartFilling, setIsSmartFilling] = useState(false);
  const [feeContext, setFeeContext] = useState<FeeContext | null>(null);
  const [affordabilityAcknowledged, setAffordabilityAcknowledged] = useState(false);
  const [showAprModal, setShowAprModal] = useState(false);
  const [vinDecodedFields, setVinDecodedFields] = useState<Set<string>>(new Set());
   const [pendingMakeSuggestion, setPendingMakeSuggestion] = useState<MakeResolution | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDE_PANEL_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  
  // Premium experience state
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPostPurchase, setShowPostPurchase] = useState(false);
  
  const { toast } = useToast();

  // Handle dealership check on mobile - show after user's first response (after name question)
  useEffect(() => {
    if (isMobile && atDealership === null) {
      // Check if user has responded once (there should be at least 2 messages: welcome + user response)
      const userMessages = chatMessages.filter(m => m.role === "user");
      if (userMessages.length === 1 && !showDealershipCheck) {
        // User just answered the name question, show dealership check
        setShowDealershipCheck(true);
      }
    }
  }, [chatMessages, isMobile, atDealership, showDealershipCheck]);

  // Handle dealership check response
  const handleDealershipCheckResponse = (isAtDealer: boolean) => {
    setAtDealership(isAtDealer);
    setShowDealershipCheck(false);
    if (isAtDealer) {
      setIsDealershipMode(true);
      toast({
        title: "Dealership Mode Enabled",
        description: "Short, tactical answers for quick decisions.",
      });
    }
  };

  // Toggle dealership mode (for desktop toggle)
  const handleDealershipModeToggle = (enabled: boolean) => {
    setIsDealershipMode(enabled);
    if (enabled) {
      setAtDealership(true);
    }
  };

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

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
        // Show post-purchase confirmation
        setShowPostPurchase(true);
        setDealEntitlementStatus("unlocked");
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

  // Negotiation confidence meter - tracks deal readiness
  const negotiationConfidence = useNegotiationConfidence(dealData);

  // Autosave hook - saves drafts automatically, handles evaluated saves
  const {
    isSaving: isAutosaving,
    lastSavedAt,
    dealStatus,
    saveAsEvaluated,
  } = useDealAutosave({
    dealData,
    progress: negotiationConfidence.progress,
    scoreResult,
    isLoggedIn,
    currentDealId,
    setCurrentDealId,
  });

  useEffect(() => {
    try {
      localStorage.setItem(DEAL_CACHE_KEY, JSON.stringify(dealData));
    } catch (e) {
      console.error("Failed to cache deal:", e);
    }
  }, [dealData]);

  // Auto-estimate insurance when vehicle info and credit score are available
  useEffect(() => {
    // Only auto-estimate if insurance is empty and we have enough data
    if (dealData.insurance) return;
    
    const hasVehicleInfo = dealData.make && dealData.model;
    const hasFinancialContext = dealData.creditScore || dealData.askingPrice;
    
    if (hasVehicleInfo && hasFinancialContext) {
      const estimate = estimateInsurance({
        make: dealData.make,
        model: dealData.model,
        year: dealData.year,
        askingPrice: dealData.askingPrice,
        creditScore: dealData.creditScore,
        isNew: !dealData.mileage || parseInt(dealData.mileage) < 100,
      });
      
      // Auto-fill the insurance field with estimate
      setDealData((prev) => ({ ...prev, insurance: String(estimate.monthly) }));
      setExtractedFields((prev) => new Set([...prev, "insurance"]));
      
      // Show a subtle toast about the estimate
      toast({
        title: "Insurance Estimated",
        description: `Estimated ~$${estimate.monthly}/mo based on ${estimate.confidence} confidence (${estimate.factors.slice(0, 2).join(", ")})`,
      });
    }
  }, [dealData.make, dealData.model, dealData.year, dealData.askingPrice, dealData.creditScore, dealData.mileage, dealData.insurance, toast]);

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
      
      // Save as evaluated deal if logged in
      if (isLoggedIn) {
        // Use a small timeout to ensure scoreResult state is set
        setTimeout(() => {
          saveAsEvaluated();
        }, 100);
      }
      
      setActiveTab("calculator");
      toast({
        title: "Score Calculated!",
        description: `Your DuoDrive Score is ${result.overall}${isLoggedIn ? " — Saved to your account!" : ""}`,
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

     // --- ENHANCED MAKE RESOLUTION (Jaro-Winkler) ---
     // Only run if we don't already have a make
     if (!dealData.make) {
       const resolution = resolveMakeFromUserText({ userText: messageToSend });
       
       // Handle confirmed make (exact match or alias)
       if (resolution.type === "confirmed") {
         setDealData(prev => ({ ...prev, make: resolution.make }));
         setExtractedFields(prev => new Set([...prev, 'make']));
         setPendingMakeSuggestion(null);
         // Continue to extract other info below
       }
       
       // Handle single suggestion (typo like "telsa" → "Tesla")
       if (resolution.type === "suggest_one") {
         setPendingMakeSuggestion(resolution);
         
         const userMessage: ChatMessage = { role: 'user', content: messageToSend };
         setChatMessages(prev => [...prev, userMessage]);
         
         const confirmMessage: ChatMessage = { 
           role: 'assistant', 
           content: `Did you mean **${resolution.suggestion}**?` 
         };
         setChatMessages(prev => [...prev, confirmMessage]);
         setChatInput("");
         return;
       }
       
       // Handle multiple suggestions (ambiguous like "hondai" → "Honda or Hyundai?")
       if (resolution.type === "suggest_many") {
         setPendingMakeSuggestion(resolution);
         
         const userMessage: ChatMessage = { role: 'user', content: messageToSend };
         setChatMessages(prev => [...prev, userMessage]);
         
         const optionsText = formatMakeOptions(resolution.options);
         const confirmMessage: ChatMessage = { 
           role: 'assistant', 
           content: `Did you mean **${optionsText}**?` 
         };
         setChatMessages(prev => [...prev, confirmMessage]);
         setChatInput("");
         return;
       }
     }
     
     // Handle response to pending suggestion
     const lowerMessage = messageToSend.toLowerCase().trim();
     if (pendingMakeSuggestion) {
       // Check if user typed one of the suggested makes directly
       if (pendingMakeSuggestion.type === "suggest_many") {
         const matchedOption = pendingMakeSuggestion.options.find(
           opt => opt.make.toLowerCase() === lowerMessage || 
                  opt.make.toLowerCase().startsWith(lowerMessage)
         );
         if (matchedOption) {
           setDealData(prev => ({ ...prev, make: matchedOption.make }));
           setExtractedFields(prev => new Set([...prev, 'make']));
           
           const confirmedMake = matchedOption.make;
           setPendingMakeSuggestion(null);
           
           const userMessage: ChatMessage = { role: 'user', content: messageToSend };
           setChatMessages(prev => [...prev, userMessage]);
           
           const followUp: ChatMessage = { 
             role: 'assistant', 
             content: `Got it — ${confirmedMake}. Which model?` 
           };
           setChatMessages(prev => [...prev, followUp]);
           setChatInput("");
           return;
         }
       }
       
       // Handle "yes" for single suggestion
       if (pendingMakeSuggestion.type === "suggest_one" && 
           (lowerMessage === 'yes' || lowerMessage === 'yeah' || lowerMessage === 'yep' || lowerMessage === 'y')) {
         setDealData(prev => ({ ...prev, make: pendingMakeSuggestion.suggestion }));
         setExtractedFields(prev => new Set([...prev, 'make']));
         
         const confirmedMake = pendingMakeSuggestion.suggestion;
         setPendingMakeSuggestion(null);
         
         const userMessage: ChatMessage = { role: 'user', content: messageToSend };
         setChatMessages(prev => [...prev, userMessage]);
         
         const followUp: ChatMessage = { 
           role: 'assistant', 
           content: `Got it — ${confirmedMake}. Which model?` 
         };
         setChatMessages(prev => [...prev, followUp]);
         setChatInput("");
         return;
       }
       
       // Handle "no" response
       if (lowerMessage === 'no' || lowerMessage === 'nope' || lowerMessage === 'n' || lowerMessage === 'neither') {
         setPendingMakeSuggestion(null);
         
         const userMessage: ChatMessage = { role: 'user', content: messageToSend };
         setChatMessages(prev => [...prev, userMessage]);
         
         const followUp: ChatMessage = { 
           role: 'assistant', 
           content: "No problem — which brand are you looking at?" 
         };
         setChatMessages(prev => [...prev, followUp]);
         setChatInput("");
         return;
       }
       
       // User typed something else - clear pending and continue
       setPendingMakeSuggestion(null);
     }
     
     // --- Standard vehicle info extraction for other fields ---
     const vehicleInfo = extractVehicleInfo(messageToSend);
     if (vehicleInfo.make || vehicleInfo.model || vehicleInfo.year || vehicleInfo.condition || vehicleInfo.price || vehicleInfo.mileage) {
       const newFields = new Set<string>();
       setDealData(prev => {
         const updated = { ...prev };
         if (vehicleInfo.make && !prev.make) {
           updated.make = vehicleInfo.make;
           newFields.add('make');
         }
         if (vehicleInfo.model && !prev.model) {
           updated.model = vehicleInfo.model;
           newFields.add('model');
         }
         if (vehicleInfo.year && !prev.year) {
           updated.year = vehicleInfo.year;
           newFields.add('year');
         }
         if (vehicleInfo.price && !prev.askingPrice) {
           updated.askingPrice = vehicleInfo.price;
           newFields.add('askingPrice');
         }
         if (vehicleInfo.mileage && !prev.mileage) {
           updated.mileage = vehicleInfo.mileage;
           newFields.add('mileage');
         }
         return updated;
       });
       if (newFields.size > 0) {
         setExtractedFields(prev => new Set([...prev, ...newFields]));
       }
     }
 
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
        // Dealership mode context
        deviceHint: isMobile ? "mobile" : "desktop",
        atDealership: atDealership ?? undefined,
        dealershipMode: isDealershipMode,
        // Progress tracking (UI source of truth)
        deal_progress_percent: negotiationConfidence.progress,
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

  // BroadcastChannel for popout window sync
  const handlePopoutMessage = useCallback((content: string) => {
    // Treat the message from popout as if typed in main tab
    sendChatMessage(content);
  }, [sendChatMessage]);

  useQuinnBroadcastMain({
    messages: chatMessages,
    dealContext: dealData,
    isLoading: isChatLoading,
    onPopoutMessage: handlePopoutMessage,
  });

  // Handle pop-out button click
  const handleOpenPopout = () => {
    const popout = openQuinnPopout();
    if (!popout) {
      toast({
        title: "Pop-out blocked",
        description: "Enable popups for DuoDrive to use pop-out mode.",
        variant: "destructive",
      });
    }
  };

  // Idle ping: send a gentle check-in after 3 minutes of inactivity
  const handleIdlePing = useCallback((message: string) => {
    // Only ping if we're on the copilot tab and have started a conversation
    if (activeTab === "copilot" && chatMessages.length > 1) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: message }]);
    }
  }, [activeTab, chatMessages.length, setChatMessages]);

  const { resetIdleTimer } = useIdlePing({
    onIdlePing: handleIdlePing,
    isLoading: isChatLoading,
    isActive: activeTab === "copilot" && chatMessages.length > 1,
  });

  // Milestone nudges at 25/50/75% progress
  const { checkMilestone, resetMilestones } = useMilestoneNudges();

  // Check for milestone nudges when progress changes
  useEffect(() => {
    if (chatMessages.length <= 1) return; // Don't nudge before conversation starts
    if (isChatLoading) return; // Don't nudge while loading
    
    const nudge = checkMilestone(negotiationConfidence.progress, isDealershipMode);
    if (nudge) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: nudge }]);
    }
  }, [negotiationConfidence.progress, isDealershipMode, chatMessages.length, isChatLoading, checkMilestone, setChatMessages]);

  // Reset idle timer when user sends a message
  const sendChatMessageWithIdleReset = useCallback(async (directMessage?: string) => {
    resetIdleTimer();
    await sendChatMessage(directMessage);
  }, [resetIdleTimer, sendChatMessage]);

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
     // Reset any pending state
     setPendingMakeSuggestion(null);
     setVinDecodedFields(new Set());
     setDealEntitlementStatus("locked");
     setAtDealership(null);
     setIsDealershipMode(false);
     setShowDealershipCheck(false);
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

  // Handle conversation message - sends to AI and triggers extraction
  const handleConversationMessage = async (message: string) => {
    // Send all messages through the AI copilot which handles extraction automatically
    // The AI will extract deal data via [DEAL_EXTRACTED] markers in its response
    // Note: sendChatMessageWithIdleReset handles adding the user message, loading state, and resets the idle timer
    await sendChatMessageWithIdleReset(message);
  };

  // Handle file upload in conversation - runs OCR and sends text to Quinn
  const handleConversationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    const fileType = file.type.includes('pdf') ? 'PDF document' : 'image';
    const uploadMessage = `📎 Uploaded ${fileType}: ${file.name}`;
    
    // Add user message showing the upload
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: uploadMessage 
    }]);

    setIsExtracting(true);
    setIsChatLoading(true);

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

      // Step 1: Run OCR to get readable text from the image
      const ocrResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-quote-ocr`, {
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

      let ocrText = "";
      if (ocrResponse.ok) {
        const ocrData = await ocrResponse.json();
        ocrText = ocrData.text || "";
        console.log("OCR extraction successful, text length:", ocrText.length);
      } else {
        console.error("OCR failed, continuing without text");
      }

      // Step 2: Also run structured extraction for form fields (parallel would be better but sequential is fine)
      const extractResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-quote`, {
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

      if (extractResponse.ok) {
        const { data: extracted } = await extractResponse.json();
        if (extracted) {
          // Update form fields with structured data
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
          
          setExtractedFields(prev => new Set([...prev, ...newExtractedFields]));
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
        }
      }

      setIsExtracting(false);

      // Step 3: Send OCR text to Quinn so AI can read and respond
      // Build message with OCR text wrapper
      const messageForQuinn = ocrText 
        ? `[IMAGE_TEXT]\n${ocrText}\n[/IMAGE_TEXT]`
        : `Uploaded image: ${file.name}`;

      // Create a synthetic user message with the OCR text (hidden from UI)
      const hiddenUserMessage: ChatMessage = { role: 'user', content: messageForQuinn };
      
      // Build deal context for Quinn
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

      // Send to Quinn with OCR content
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: uploadMessage }, hiddenUserMessage],
          dealContext,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response");
      }

      // Stream Quinn's response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

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
      console.error("Conversation upload error:", error);
      toast({
        title: "Upload Error",
        description: error instanceof Error ? error.message : "Failed to process the file",
        variant: "destructive",
      });
      // Add error message to chat
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: "I had trouble reading that file. Could you try uploading it again, or describe what you see on the sticker?"
      }]);
    } finally {
      setIsExtracting(false);
      setIsChatLoading(false);
      // Reset input so same file can be uploaded again
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <Layout>
      <SEO 
        title="Deal Room"
        description="Chat with Quinn, your AI copilot for car buying. Get your DuoDrive Score, identify hidden fees, and learn what to say to the dealer."
        canonical="/deal-room"
        keywords="car deal analyzer, car deal review, car buying AI, DuoDrive Score, car price analysis, Quinn AI"
      />
      {/* First-visit tutorial overlay */}
      <DealRoomTutorial />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Deal Room <span className="text-muted-foreground font-normal text-lg md:text-xl">— Send me your deal, I'll break it down for you.</span>
          </h1>
          <div className="flex items-center gap-2">
            {/* Pop-out Quinn button - desktop only, icon-only */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenPopout}
                  className="hidden md:flex h-8 w-8"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Pop out Quinn — keep open while you browse</p>
              </TooltipContent>
            </Tooltip>

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
              <div className="max-w-4xl mx-auto space-y-8">
                {/* SECTION A: How This Car Is Priced (Market Context) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">How This Car Is Priced</h2>
                      <p className="text-sm text-muted-foreground">Market context and pricing position</p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <MarketReferenceCard 
                      trueMarketPrice={scoreResult.trueMarketPrice}
                      askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice)}
                    />
                    <PricingPositionCard 
                      dealPriceGapPercent={scoreResult.dealPriceGapPercent}
                      dealPriceGap={scoreResult.dealPriceGap}
                    />
                  </div>
                  
                  <DealerAddOnsCard
                    addOns={parseNumber(dealData.addOns)}
                    dealerFee={parseNumber(dealData.dealerFee)}
                    docFee={parseNumber(dealData.docFee)}
                    askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice) || 25000}
                    onViewScripts={() => setActiveTab("scripts")}
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">Personal Fit</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* SECTION B: Is This a Good Fit for You? (Personal Fit) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Is This a Good Fit for You?</h2>
                      <p className="text-sm text-muted-foreground">Personal affordability and budget alignment</p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <MonthlyRealityCard
                      monthlyPayment={scoreResult.monthlyPayment}
                      insurance={parseNumber(dealData.insurance) || 150}
                      fuelCost={parseNumber(dealData.fuelCost) || 200}
                      maintenance={parseNumber(dealData.maintenance) || 50}
                      totalMonthlyCost={scoreResult.totalMonthlyCost}
                      monthlyIncome={parseNumber(dealData.monthlyIncome) || 5000}
                      operatingCostBurden={scoreResult.operatingCostBurden}
                    />
                    <BudgetComfortCard
                      affordabilityStatus={scoreResult.affordabilityStatus}
                      priceToIncomeRatio={scoreResult.priceToIncomeRatio}
                      paymentBurdenPercent={scoreResult.paymentBurdenPercent}
                      operatingCostBurden={scoreResult.operatingCostBurden}
                      monthlyPayment={scoreResult.monthlyPayment}
                      monthlyIncome={parseNumber(dealData.monthlyIncome) || 5000}
                      askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice)}
                      isAcknowledged={affordabilityAcknowledged}
                      onAcknowledge={() => setAffordabilityAcknowledged(true)}
                    />
                  </div>
                  
                  {/* Why This Matters - only shows when stretched */}
                  <WhyThisMattersCard
                    affordabilityStatus={scoreResult.affordabilityStatus}
                    onShowAlternatives={() => {
                      // Future: implement alternatives search
                      toast({
                        title: "Coming Soon",
                        description: "Alternative vehicle search is coming in a future update.",
                      });
                    }}
                    onShowWhatWouldWork={() => {
                      // Future: implement what-would-work calculator
                      toast({
                        title: "Coming Soon", 
                        description: "Budget scenario calculator is coming in a future update.",
                      });
                    }}
                  />
                </div>

                {/* DuoDrive Score Summary */}
                <div className="p-6 rounded-2xl bg-card border border-border shadow-elevated">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ScoreRing score={scoreResult.overall} size="lg" />
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-lg font-semibold text-foreground mb-2">Your DuoDrive Score</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {scoreResult.recommendation}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <Button onClick={() => setActiveTab("overview")} variant="outline" size="sm">
                          View Full Breakdown
                        </Button>
                        <Button onClick={() => setActiveTab("scripts")} size="sm">
                          <MessageCircle className="h-4 w-4 mr-2" />
                          What To Say Next
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Learn More Section (collapsed by default) */}
                <details className="group p-5 rounded-2xl bg-muted/50 border border-border">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium text-foreground">How is the DuoDrive Score calculated?</span>
                    </div>
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center group-open:rotate-180 transition-transform">
                      <TrendingDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </summary>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">
                      The DuoDrive Score (0-100) evaluates your car deal across market pricing, affordability rules, and deal structure to determine if it's right for you.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <span>Market pricing position</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Heart className="h-4 w-4 text-emerald-500" />
                        <span>Budget fit (12% income rule)</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        <span>Fee transparency</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="h-4 w-4 text-purple-500" />
                        <span>Financial safety rules</span>
                      </div>
                    </div>
                    <Button variant="link" size="sm" className="mt-3 p-0 h-auto" asChild>
                      <Link to="/glossary">View Full Glossary →</Link>
                    </Button>
                  </div>
                </details>

                {/* Sign in prompt */}
                {isLoggedIn === false && (
                  <SignInPrompt className="pt-4" />
                )}
              </div>
            )}
          </TabsContent>

          {/* AI COPILOT TAB - CONVERSATION-FIRST EXPERIENCE */}
          <TabsContent value="copilot" className="animate-fade-in">
            {/* Post-purchase confirmation - shows after successful payment */}
            {showPostPurchase && dealEntitlementStatus === "unlocked" && (
              <PostPurchaseConfirmation
                isVisible={showPostPurchase}
                onDismiss={() => setShowPostPurchase(false)}
                onSaveDeal={() => {
                  // Scroll to save deal section or trigger save
                  toast({
                    title: "Deal Saved",
                    description: "Your deal has been saved to your account.",
                  });
                }}
                onCompareAnother={handleNewDeal}
                className="mb-6"
              />
            )}
            
            {/* Negotiation Confidence Meter - sticky at top */}
            <NegotiationConfidenceMeter 
              confidence={negotiationConfidence}
              className="mb-6"
              isLoggedIn={isLoggedIn ?? false}
              isSaving={isAutosaving}
              lastSavedAt={lastSavedAt}
            />
            
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main conversation area */}
              <div className="lg:col-span-2">
                <ConversationCanvas
                  messages={chatMessages}
                  onSendMessage={handleConversationMessage}
                  onClearMessages={handleNewDeal}
                  onFileUpload={handleConversationUpload}
                  onFirstMessageAnimated={markFirstMessageAnimated}
                  isLoading={isChatLoading || isExtractingText}
                  isExtracting={isExtracting}
                  scoreResult={scoreResult}
                  onViewAnalysis={() => setActiveTab("overview")}
                  isDealershipMode={isDealershipMode}
                  onDealershipModeChange={handleDealershipModeToggle}
                  showDealershipCheck={showDealershipCheck}
                  onDealershipCheckResponse={handleDealershipCheckResponse}
                  dealContext={{
                    askingPrice: dealData.askingPrice,
                    negotiatedPrice: dealData.negotiatedPrice,
                    monthlyPayment: scoreResult?.monthlyPayment?.toString(),
                    apr: dealData.apr,
                    term: dealData.term,
                    downPayment: dealData.downPayment,
                    tradeIn: dealData.tradeIn,
                    dealerFee: dealData.dealerFee,
                    docFee: dealData.docFee,
                    addOns: dealData.addOns,
                    taxes: dealData.taxes,
                    zipCode: dealData.buyerZip,
                    affordabilityRisk: scoreResult?.affordabilityStatus === "blocked" || scoreResult?.affordabilityStatus === "outside_budget" ? "high" 
                      : scoreResult?.affordabilityStatus === "stretch_warning" ? "medium" 
                      : "low",
                  }}
                  targets={{
                    targetOTD: scoreResult?.trueMarketPrice?.toString(),
                    targetTermMonths: dealData.term || "60",
                  }}
                  onGoToWhatToSay={() => setActiveTab("what-to-say")}
                  onCompareAnother={handleNewDeal}
                   pendingMakeSuggestion={pendingMakeSuggestion}
                />
              </div>
              
              {/* How to use Quinn - Side Panel */}
              <div className="hidden lg:block">
                <div className="sticky top-24 space-y-4">
                  <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
                    <HowToUseQuinn />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Tab descriptions - subtle helper text */}
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
              <span><strong>The Deal</strong> — Vehicle & pricing summary</span>
              <span><strong>Calculator</strong> — How the numbers work</span>
              <span><strong>Overview</strong> — Is this a good fit?</span>
              <span><strong>What to Say</strong> — Dealer-ready responses</span>
            </div>
          </TabsContent>

          {/* APR Estimation Modal */}
          <EstimateAprModal
            open={showAprModal}
            onOpenChange={setShowAprModal}
            defaultCondition={dealData.mileage && parseInt(dealData.mileage) > 0 ? "used" : "new"}
            defaultTermMonths={parseInt(dealData.term) as LoanTerm || 60}
            onApply={({ aprEstimated, creditTier }) => {
              handleInputChange("apr", aprEstimated);
              if (creditTier !== "unknown") {
                const creditLabels: Record<CreditTier, string> = {
                  excellent: "Excellent (740+)",
                  good: "Good (680-739)",
                  fair: "Fair (620-679)",
                  building: "Building (<620)",
                  unknown: "",
                };
                handleInputChange("creditScore", creditLabels[creditTier]);
              }
              toast({
                title: "APR Estimated",
                description: `Using ${aprEstimated}% APR (conservative estimate)`,
              });
            }}
          />

          {/* WHAT TO SAY NEXT TAB */}
          <TabsContent value="scripts" className="animate-fade-in">
            <div className="max-w-4xl mx-auto py-4 space-y-6">
              {/* When Premium is disabled, show Coming Soon directly */}
              {!FEATURES.premiumEnabled ? (
                <WhatToSayNext 
                  dealData={dealData} 
                  scoreResult={scoreResult}
                  feeContext={feeContext || undefined}
                  onBackToChat={() => setActiveTab("copilot")}
                />
              ) : dealEntitlementStatus === "loading" ? (
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
                  {/* Affordability Warning - shows when deal is outside budget */}
                  {(() => {
                    const vehiclePrice = parseNumber(dealData.negotiatedPrice) || parseNumber(dealData.askingPrice);
                    const monthlyIncome = parseNumber(dealData.monthlyIncome);
                    const downPayment = parseNumber(dealData.downPayment);
                    const apr = parseNumber(dealData.apr) || 7;
                    const termMonths = parseInt(dealData.term) || 60;
                    
                    if (vehiclePrice > 0 && monthlyIncome > 0) {
                      const affordabilityResult = analyzeAffordability({
                        grossAnnualIncome: monthlyIncome * 12,
                        downPayment,
                        vehiclePrice,
                        apr,
                        termMonths,
                        insurance: parseNumber(dealData.insurance) || 150,
                        fuelCost: parseNumber(dealData.fuelCost) || 200,
                        maintenance: parseNumber(dealData.maintenance) || 50,
                        isLuxuryVehicle: isLuxuryBrand(dealData.make || ''),
                      });
                      
                      const isBlocking = affordabilityResult.overallStatus === 'outside_budget' || 
                                         affordabilityResult.overallStatus === 'blocked';
                      
                      // If blocking and not acknowledged, show warning instead of scripts
                      if (isBlocking && !affordabilityAcknowledged) {
                        return (
                          <AffordabilityWarning 
                            result={affordabilityResult}
                            onAcknowledge={() => setAffordabilityAcknowledged(true)}
                            isAcknowledged={affordabilityAcknowledged}
                          />
                        );
                      }
                      
                      // If there are any warnings (even acknowledged), show a smaller notice
                      if (affordabilityResult.overallStatus !== 'fits_budget') {
                        return (
                          <>
                            <AffordabilityWarning 
                              result={affordabilityResult}
                              onAcknowledge={() => setAffordabilityAcknowledged(true)}
                              isAcknowledged={affordabilityAcknowledged}
                            />
                            
                            {/* Fee Breakdown for context */}
                            <FeeBreakdown
                              docFee={parseNumber(dealData.docFee)}
                              dealerFee={parseNumber(dealData.dealerFee)}
                              addOns={parseNumber(dealData.addOns)}
                              taxes={parseNumber(dealData.taxes)}
                              registration={parseNumber(dealData.registration)}
                              askingPrice={vehiclePrice || 25000}
                              onFeeContextChange={setFeeContext}
                            />
                            
                            {/* Negotiation Scripts */}
                            <WhatToSayNext 
                              dealData={dealData} 
                              scoreResult={scoreResult}
                              feeContext={feeContext || undefined}
                              onBackToChat={() => setActiveTab("copilot")}
                            />
                          </>
                        );
                      }
                    }
                    
                    // Default: show scripts normally
                    return (
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
                          onBackToChat={() => setActiveTab("copilot")}
                        />
                      </>
                    );
                  })()}
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

                {/* Market & Budget Summary - Plain English */}
                <div className="lg:col-span-3 p-6 rounded-2xl bg-card border border-border shadow-card">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Market & Budget Summary</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Market Context */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">How This Car Is Priced</h3>
                      <div className="p-4 rounded-xl bg-muted">
                        <p className="text-sm text-muted-foreground mb-1">Market Reference Range</p>
                        <p className="text-xl font-bold text-foreground">
                          ${Math.round(scoreResult.trueMarketPrice * 0.9).toLocaleString()} – ${Math.round(scoreResult.trueMarketPrice * 1.1).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Based on similar vehicles</p>
                      </div>
                      <div className={`p-4 rounded-xl ${
                        scoreResult.dealPriceGapPercent <= 0 ? 'bg-green-50 dark:bg-green-950/30' :
                        scoreResult.dealPriceGapPercent <= 10 ? 'bg-blue-50 dark:bg-blue-950/30' :
                        scoreResult.dealPriceGapPercent <= 25 ? 'bg-yellow-50 dark:bg-yellow-950/30' :
                        'bg-red-50 dark:bg-red-950/30'
                      }`}>
                        <p className="text-sm text-muted-foreground mb-1">Pricing Position</p>
                        <p className={`text-lg font-bold ${
                          scoreResult.dealPriceGapPercent <= 0 ? 'text-green-600 dark:text-green-400' :
                          scoreResult.dealPriceGapPercent <= 10 ? 'text-blue-600 dark:text-blue-400' :
                          scoreResult.dealPriceGapPercent <= 25 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {scoreResult.dealPriceGapPercent <= -5 ? 'Below Typical' :
                           scoreResult.dealPriceGapPercent <= 10 ? 'Typical Range' :
                           scoreResult.dealPriceGapPercent <= 25 ? 'Above Typical' :
                           'Well Above Typical'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scoreResult.dealPriceGap >= 0 ? `$${scoreResult.dealPriceGap.toLocaleString()} above reference` : `$${Math.abs(scoreResult.dealPriceGap).toLocaleString()} below reference`}
                        </p>
                      </div>
                    </div>

                    {/* Personal Fit */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Budget Fit</h3>
                      <div className="p-4 rounded-xl bg-muted">
                        <p className="text-sm text-muted-foreground mb-1">Your Comfort Zone Max</p>
                        <p className="text-xl font-bold text-foreground">${scoreResult.customerMaxSafePrice.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Based on 12% income rule</p>
                      </div>
                      <div className={`p-4 rounded-xl ${
                        scoreResult.affordabilityStatus === 'fits_budget' ? 'bg-green-50 dark:bg-green-950/30' :
                        scoreResult.affordabilityStatus === 'stretch_warning' ? 'bg-yellow-50 dark:bg-yellow-950/30' :
                        'bg-red-50 dark:bg-red-950/30'
                      }`}>
                        <p className="text-sm text-muted-foreground mb-1">Budget Status</p>
                        <p className={`text-lg font-bold ${
                          scoreResult.affordabilityStatus === 'fits_budget' ? 'text-green-600 dark:text-green-400' :
                          scoreResult.affordabilityStatus === 'stretch_warning' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {scoreResult.affordabilityStatus === 'fits_budget' ? 'Comfortable' :
                           scoreResult.affordabilityStatus === 'stretch_warning' ? 'Stretch' :
                           'High Risk'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scoreResult.customerFitGap >= 0 
                            ? `$${scoreResult.customerFitGap.toLocaleString()} under your comfort zone` 
                            : `$${Math.abs(scoreResult.customerFitGap).toLocaleString()} over your comfort zone`}
                        </p>
                      </div>
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

                {/* Sign in prompt */}
                {isLoggedIn === false && (
                  <div className="lg:col-span-3">
                    <SignInPrompt className="pt-2" />
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
        
        {/* Premium Decision Modal */}
        <PremiumDecisionModal
          open={showPremiumModal}
          onOpenChange={setShowPremiumModal}
          dealId={currentDealId}
          dealName={dealData.name || `${dealData.year} ${dealData.make} ${dealData.model}`.trim() || undefined}
        />
      </div>
    </Layout>
  );
}
