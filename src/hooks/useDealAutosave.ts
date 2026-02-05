 import { useEffect, useRef, useCallback, useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 
 export type DealStatus = "draft" | "evaluated" | "archived";

// Progress thresholds that trigger immediate saves
const SAVE_THRESHOLDS = [25, 50, 75];
 
 interface DealData {
   year?: string;
   make?: string;
   model?: string;
   trim?: string;
   mileage?: string;
   vin?: string;
   dealerZip?: string;
   askingPrice?: string;
   negotiatedPrice?: string;
   downPayment?: string;
   tradeIn?: string;
   apr?: string;
   term?: string;
   docFee?: string;
   dealerFee?: string;
   addOns?: string;
   taxes?: string;
   registration?: string;
   buyerZip?: string;
   monthlyIncome?: string;
   creditScore?: string;
   insurance?: string;
   fuelCost?: string;
   maintenance?: string;
   name?: string;
   [key: string]: string | undefined;
 }
 
 interface UseDealAutosaveOptions {
   dealData: DealData;
   progress: number;
   scoreResult: any;
   isLoggedIn: boolean | null;
   currentDealId: string | null;
   setCurrentDealId: (id: string | null) => void;
 }
 
 // Minimum field set for a valid draft
 function hasMinimumFields(dealData: DealData): boolean {
   const hasVehicle = !!(dealData.year && dealData.make && dealData.model);
   const hasPriceAnchor = !!(
     dealData.askingPrice ||
     dealData.negotiatedPrice ||
     dealData.monthlyIncome
   );
   return hasVehicle || hasPriceAnchor;
 }
 
 // Generate a deal name from vehicle info
 function generateDealName(dealData: DealData): string {
   const parts = [dealData.year, dealData.make, dealData.model].filter(Boolean);
   if (parts.length > 0) {
     return parts.join(" ");
   }
   return `Draft Deal - ${new Date().toLocaleDateString()}`;
 }
 
 export function useDealAutosave({
   dealData,
   progress,
   scoreResult,
   isLoggedIn,
   currentDealId,
   setCurrentDealId,
 }: UseDealAutosaveOptions) {
   const { toast } = useToast();
   const [isSaving, setIsSaving] = useState(false);
   const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
   const [dealStatus, setDealStatus] = useState<DealStatus>("draft");
   const lastSavedDataRef = useRef<string>("");
   const debounceTimerRef = useRef<number | null>(null);
  const lastSavedThresholdRef = useRef<number>(0);
 
   // Check if data has changed since last save
   const hasDataChanged = useCallback(() => {
     const currentData = JSON.stringify({ dealData, progress });
     return currentData !== lastSavedDataRef.current;
   }, [dealData, progress]);
 
   // Save deal as draft
   const saveDraft = useCallback(async (silent = true) => {
     if (!isLoggedIn || isSaving) return null;
     if (!hasMinimumFields(dealData)) return null;
     if (!hasDataChanged()) return currentDealId;
 
     setIsSaving(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return null;
 
       const dealRecord = {
         user_id: user.id,
         name: generateDealName(dealData),
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
         status: "draft" as DealStatus,
         progress: Math.round(progress),
         score_result: null, // Drafts don't have scores
       };
 
       let savedDealId: string | null = currentDealId;
 
       if (currentDealId) {
         // Update existing draft
         const { error } = await supabase
           .from("deals")
           .update(dealRecord)
           .eq("id", currentDealId)
           .eq("status", "draft"); // Only update if still a draft
 
         if (error) throw error;
       } else {
         // Create new draft
         const { data, error } = await supabase
           .from("deals")
           .insert(dealRecord)
           .select("id")
           .single();
 
         if (error) throw error;
         savedDealId = data.id;
         setCurrentDealId(data.id);
       }
 
       lastSavedDataRef.current = JSON.stringify({ dealData, progress });
       setLastSavedAt(new Date());
       setDealStatus("draft");
 
       if (!silent) {
         toast({
           title: "Draft Saved",
           description: "Your deal progress has been saved.",
         });
       }
 
       return savedDealId;
     } catch (error) {
       console.error("Error saving draft:", error);
       if (!silent) {
         toast({
           title: "Save Failed",
           description: "Could not save your deal. Please try again.",
           variant: "destructive",
         });
       }
       return null;
     } finally {
       setIsSaving(false);
     }
   }, [isLoggedIn, isSaving, dealData, progress, currentDealId, hasDataChanged, setCurrentDealId, toast]);
 
   // Save deal as evaluated (with score)
   const saveAsEvaluated = useCallback(async () => {
     if (!isLoggedIn || isSaving) return null;
     if (!scoreResult) {
       toast({
         title: "No Score",
         description: "Calculate a score first before saving as evaluated.",
         variant: "destructive",
       });
       return null;
     }
 
     setIsSaving(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) return null;
 
       // First save/update the deal
       const dealRecord = {
         user_id: user.id,
         name: generateDealName(dealData),
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
         status: "evaluated" as DealStatus,
         progress: 100,
         score_result: scoreResult,
       };
 
       let savedDealId: string;
 
       if (currentDealId) {
         // Update existing deal to evaluated
         const { error } = await supabase
           .from("deals")
           .update(dealRecord)
           .eq("id", currentDealId);
 
         if (error) throw error;
         savedDealId = currentDealId;
       } else {
         // Create new evaluated deal
         const { data, error } = await supabase
           .from("deals")
           .insert(dealRecord)
           .select("id")
           .single();
 
         if (error) throw error;
         savedDealId = data.id;
         setCurrentDealId(data.id);
       }
 
       // Create score trend record
       const { error: scoreError } = await supabase
         .from("deal_scores")
         .insert({
           deal_id: savedDealId,
           user_id: user.id,
           score: scoreResult.overall || scoreResult.overallScore || 0,
           summary: scoreResult.recommendation || scoreResult.summary || null,
           flags_json: scoreResult.flags || scoreResult.riskFactors || [],
           score_breakdown: {
             dealHealth: scoreResult.dealHealth,
             affordability: scoreResult.affordability,
             trueMarketPrice: scoreResult.trueMarketPrice,
             monthlyPayment: scoreResult.monthlyPayment,
           },
         });
 
       if (scoreError) {
         console.error("Error creating score record:", scoreError);
         // Don't fail the whole operation, just log it
       }
 
       lastSavedDataRef.current = JSON.stringify({ dealData, progress: 100 });
       setLastSavedAt(new Date());
       setDealStatus("evaluated");
 
       toast({
         title: "Deal Evaluated & Saved!",
         description: `Score: ${scoreResult.overall || scoreResult.overallScore}/100 - Added to your score trends.`,
       });
 
       return savedDealId;
     } catch (error) {
       console.error("Error saving evaluated deal:", error);
       toast({
         title: "Save Failed",
         description: "Could not save your evaluated deal. Please try again.",
         variant: "destructive",
       });
       return null;
     } finally {
       setIsSaving(false);
     }
   }, [isLoggedIn, isSaving, dealData, scoreResult, currentDealId, setCurrentDealId, toast]);
 
  // Auto-save as draft when progress crosses thresholds or minimum fields met
   useEffect(() => {
     if (!isLoggedIn) return;
 
    const shouldAutosave = progress >= 25 || hasMinimumFields(dealData);
     if (!shouldAutosave) return;
 
    // Check if we crossed a threshold - trigger immediate save
    const crossedThreshold = SAVE_THRESHOLDS.find(
      (threshold) => progress >= threshold && lastSavedThresholdRef.current < threshold
    );

    if (crossedThreshold) {
      lastSavedThresholdRef.current = crossedThreshold;
      saveDraft(true); // Immediate save on threshold crossing
      return;
    }

     // Debounce autosave to avoid too many writes
     if (debounceTimerRef.current) {
       window.clearTimeout(debounceTimerRef.current);
     }
 
     debounceTimerRef.current = window.setTimeout(() => {
       saveDraft(true); // Silent save
     }, 3000); // 3 second debounce
 
     return () => {
       if (debounceTimerRef.current) {
         window.clearTimeout(debounceTimerRef.current);
       }
     };
   }, [isLoggedIn, progress, dealData, saveDraft]);
 
   return {
     isSaving,
     lastSavedAt,
     dealStatus,
     saveDraft,
     saveAsEvaluated,
   };
 }