import { useState, useEffect } from "react";
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
import { Upload, Calculator, Bot, BookOpen, BarChart3, TrendingDown, Wrench, Shield, DollarSign, Heart, Search, Loader2, FileCheck, Camera, ImagePlus, FilePlus2, TrendingUp, Target, AlertTriangle, CheckCircle2, XCircle, Wallet, Download, Mail, Sparkles, Send, FileText, ArrowRight, Clipboard, Wand2, RotateCcw, HelpCircle, MessageSquare, MessageCircle } from "lucide-react";
import { WhatToSayNext } from "@/components/WhatToSayNext";
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

const glossaryCategories = [
  { id: "all", label: "All Terms" },
  { id: "duodrive", label: "DuoDrive Score" },
  { id: "pricing", label: "Pricing & Costs" },
  { id: "financing", label: "Financing" },
  { id: "fees", label: "Fees & Add-Ons" },
  { id: "vehicle", label: "Vehicle Info" },
  { id: "insurance", label: "Insurance" },
  { id: "negotiation", label: "Negotiation" },
  { id: "tactics", label: "Dealer Tactics" },
  { id: "maintenance", label: "Maintenance" },
  { id: "features", label: "Vehicle Features" },
];

const glossaryTerms = [
  // DuoDrive Score Terms
  { term: "DuoDrive Score", definition: "A comprehensive 0-100 score that evaluates your car deal across five pillars: depreciation, reliability, safety, deal health, and affordability. Higher scores indicate better deals.", category: "duodrive", tip: "Aim for a score of 70+ for a good deal, 80+ for a great deal." },
  { term: "Deal Price Gap (DPG)", definition: "The difference between the asking price and the estimated true market value. A negative gap means you're getting a deal below market value; a positive gap means you're paying above market value.", category: "duodrive", tip: "Aim for a DPG of 0% or lower - that means you're at or below market value." },
  { term: "Customer Max Safe Price (CMSP)", definition: "The maximum vehicle price you can safely afford based on your monthly income. Calculated using the 12% rule: your monthly car payment should not exceed 12% of your gross monthly income.", category: "duodrive", tip: "Stay at or below your CMSP to avoid financial strain." },
  { term: "Customer Fit Gap (CFG)", definition: "The difference between the asking price and what you can safely afford (CMSP). A negative gap means you're within budget; a positive gap shows how much the car exceeds your safe spending limit.", category: "duodrive", tip: "A negative CFG is ideal - it means the car fits your budget." },
  { term: "True Market Price (TMP)", definition: "The estimated fair market value of a vehicle based on its year, mileage, condition, and comparable sales data. This is what the car is actually worth, not what the dealer is asking.", category: "duodrive", tip: "Compare TMP to asking price to see if you're overpaying." },
  { term: "Payment Burden", definition: "The percentage of your monthly income that goes toward your car payment alone. Financial experts recommend keeping this under 12% to maintain healthy finances.", category: "duodrive", tip: "Keep payment burden under 12% of your gross monthly income." },
  { term: "Total Operating Cost", definition: "The total percentage of your monthly income spent on all car-related expenses including payment, insurance, fuel, and maintenance. A comprehensive measure of affordability.", category: "duodrive", tip: "Keep total operating cost under 20% of your gross monthly income." },
  { term: "Interest Ratio", definition: "The percentage of your total loan payments that goes toward interest rather than principal. A higher ratio means you're paying more for the privilege of borrowing.", category: "duodrive", tip: "Lower interest ratios mean more of your payment builds equity." },
  
  // Pricing & Costs
  { term: "MSRP", definition: "Manufacturer's Suggested Retail Price - the sticker price set by the manufacturer. This is the starting point for negotiations, not what you should pay.", category: "pricing", tip: "Always negotiate below MSRP on non-luxury vehicles." },
  { term: "Invoice Price", definition: "The price the dealer pays the manufacturer for the vehicle. Dealers often receive additional incentives below this price.", category: "pricing", tip: "A fair deal is typically $500-$1,500 above invoice." },
  { term: "Out-the-Door Price", definition: "The total amount you'll pay including all taxes, fees, and add-ons. This is the only number that matters.", category: "pricing", tip: "Always negotiate based on OTD price, not monthly payment." },
  { term: "Market Adjustment", definition: "An additional markup dealers add above MSRP during high demand. Completely negotiable and often avoidable.", category: "pricing", tip: "Walk away from market adjustments - shop other dealers." },
  { term: "Destination Charge", definition: "The fee to transport the vehicle from the factory to the dealership. This is legitimate and typically non-negotiable ($900-$1,800).", category: "pricing", tip: "This fee is the same at every dealer for the same vehicle." },
  { term: "Trade-In Value", definition: "What a dealer offers for your current vehicle toward a new purchase. Often undervalued by dealers.", category: "pricing", tip: "Get quotes from Carmax, Carvana, and KBB before visiting dealers." },
  { term: "Negative Equity", definition: "When you owe more on your current car than it's worth. This amount gets rolled into your new loan.", category: "pricing", tip: "Avoid rolling negative equity - it's a debt trap." },
  { term: "Capitalized Cost", definition: "The negotiated price of the vehicle in a lease, equivalent to purchase price. The starting point for calculating lease payments.", category: "pricing", tip: "Negotiate cap cost down just like you would a purchase price." },
  { term: "Cap Cost Reduction", definition: "A down payment on a lease that reduces the capitalized cost. Lowers monthly payments but lost if car is totaled.", category: "pricing", tip: "Don't put large amounts down on leases - risk losing it all." },
  { term: "Money Factor", definition: "The interest rate used in lease calculations. Multiply by 2,400 to get the approximate APR equivalent.", category: "pricing", tip: "A money factor of 0.00125 equals roughly 3% APR." },
  { term: "Acquisition Fee", definition: "A fee charged by the leasing company to set up the lease. Typically $595-$1,095 and usually non-negotiable.", category: "pricing", tip: "This fee is standard but sometimes can be rolled into payments." },
  { term: "Disposition Fee", definition: "A fee charged at the end of a lease if you don't buy or lease another vehicle. Usually $300-$500.", category: "pricing", tip: "Sometimes waived if you lease another vehicle from same brand." },
  { term: "True Market Value", definition: "Edmunds' estimate of what others are actually paying for a vehicle in your area. More accurate than MSRP.", category: "pricing", tip: "Use TMV as your target price when negotiating." },
  { term: "Dealer Cost", definition: "The actual cost to the dealer including invoice, holdback, and incentives. Lower than invoice price.", category: "pricing", tip: "True dealer cost is 2-3% below invoice on most vehicles." },
  
  // Financing
  { term: "APR", definition: "Annual Percentage Rate - the yearly interest rate charged on borrowed money, including fees. Lower is better.", category: "financing", tip: "Get pre-approved from your bank/credit union before visiting dealers." },
  { term: "Loan Term", definition: "The length of time you have to repay the loan, typically 36-84 months. Longer terms mean more interest paid.", category: "financing", tip: "Keep terms at 60 months or less to avoid being underwater." },
  { term: "Down Payment", definition: "The upfront cash you put toward the purchase. Reduces your loan amount and monthly payment.", category: "financing", tip: "Aim for at least 20% down to avoid negative equity." },
  { term: "Principal", definition: "The actual amount borrowed, not including interest. This is what you're paying down each month.", category: "financing", tip: "Extra payments toward principal save you money on interest." },
  { term: "Pre-Approval", definition: "Getting approved for financing before shopping. Gives you negotiating power and a rate to beat.", category: "financing", tip: "Always get pre-approved - it's your strongest negotiating tool." },
  { term: "Subprime Loan", definition: "High-interest loans for buyers with poor credit (below 620). Rates can exceed 15-20%.", category: "financing", tip: "Work on improving credit before buying if possible." },
  { term: "Buy Rate", definition: "The actual interest rate you qualify for. Dealers often mark this up for profit.", category: "financing", tip: "Ask what the buy rate is vs. the rate they're offering." },
  { term: "Dealer Reserve", definition: "Extra profit dealers make by marking up your interest rate. Can add thousands to your loan.", category: "financing", tip: "Compare dealer financing to your pre-approved rate." },
  { term: "Residual Value", definition: "The predicted value of a vehicle at the end of a lease term. Higher residual means lower lease payments.", category: "financing", tip: "Research residual values before leasing - they vary by brand." },
  { term: "Simple Interest", definition: "Interest calculated only on the remaining principal balance. Most auto loans use simple interest.", category: "financing", tip: "Paying early or extra reduces total interest with simple interest loans." },
  { term: "Amortization", definition: "How your loan payments are split between principal and interest over time. Early payments are mostly interest.", category: "financing", tip: "Request an amortization schedule to see where your money goes." },
  { term: "Balloon Payment", definition: "A large final payment due at the end of some loans. Reduces monthly payments but creates end-of-term burden.", category: "financing", tip: "Avoid balloon payments unless you have a plan to refinance." },
  { term: "Refinancing", definition: "Replacing your current auto loan with a new one, usually at a lower rate. Can save thousands over time.", category: "financing", tip: "Refinance after 6-12 months of on-time payments to get better rates." },
  { term: "Credit Score", definition: "A number (300-850) representing your creditworthiness. Higher scores get lower interest rates.", category: "financing", tip: "Check your score free at CreditKarma before shopping." },
  { term: "Debt-to-Income Ratio", definition: "Your monthly debt payments divided by gross income. Lenders prefer under 36% total.", category: "financing", tip: "Lower DTI means better loan terms and higher approval chances." },
  { term: "Co-Signer", definition: "Someone who agrees to be responsible for your loan if you default. Helps those with poor/no credit.", category: "financing", tip: "Co-signers take on real risk - don't damage their credit." },
  { term: "0% APR Financing", definition: "Manufacturer-subsidized loans with no interest. Often requires excellent credit and forgoing rebates.", category: "financing", tip: "Compare 0% to rebate + bank financing - rebate often wins." },
  
  // Fees & Add-Ons
  { term: "Doc Fee", definition: "Documentation fee charged by dealers for processing paperwork. Varies by state ($0-$1,000+).", category: "fees", tip: "Know your state's cap - some states limit doc fees." },
  { term: "Dealer Fee", definition: "A catch-all fee dealers charge for overhead. Often negotiable despite what they claim.", category: "fees", tip: "Ask for an itemized breakdown and negotiate." },
  { term: "Dealer Add-Ons", definition: "Extra products like window tint, paint protection, or nitrogen tires. Usually overpriced by 300-500%.", category: "fees", tip: "Decline all add-ons - buy aftermarket if you want them." },
  { term: "VIN Etching", definition: "Etching the VIN into windows as theft protection. Costs dealers $30 but charged at $300-$500.", category: "fees", tip: "Always decline - you can DIY for under $25." },
  { term: "Paint Protection Film", definition: "Clear protective film applied to bumpers and hoods. Dealer price is 3-4x independent shop pricing.", category: "fees", tip: "Get quotes from detailers - same product for much less." },
  { term: "Fabric Protection", definition: "Spray-on fabric guard for seats. Essentially Scotchgard charged at $200-$400.", category: "fees", tip: "Buy a $15 can of Scotchgard and do it yourself." },
  { term: "Nitrogen Tires", definition: "Filling tires with nitrogen instead of air. Provides minimal benefit for $100-$300.", category: "fees", tip: "Regular air is fine - Costco offers free nitrogen." },
  { term: "Extended Warranty", definition: "Additional coverage beyond the factory warranty. Highly marked up at dealers.", category: "fees", tip: "Buy from third parties for 50% less if you want coverage." },
  { term: "Rustproofing", definition: "Undercoating or spray applied to prevent rust. Modern cars don't need it - a dealer profit center.", category: "fees", tip: "Cars today have galvanized steel - rustproofing is unnecessary." },
  { term: "Undercoating", definition: "A rubberized spray applied to the undercarriage. Often redundant with factory protection.", category: "fees", tip: "Decline - factory undercoating is sufficient on modern vehicles." },
  { term: "Pinstriping", definition: "Decorative lines added to the car's exterior. Cheap vinyl charged at $200-$400.", category: "fees", tip: "If you want it, any detail shop will do it for $50." },
  { term: "Wheel Locks", definition: "Special lug nuts requiring a key to remove. Cost dealers $20, charged at $150+.", category: "fees", tip: "Buy them on Amazon for $25 if you want them." },
  { term: "All-Weather Floor Mats", definition: "Rubber mats protecting the carpet. Marked up 100-200% at dealers.", category: "fees", tip: "Buy from WeatherTech directly - same quality, half price." },
  { term: "Window Tint", definition: "Film applied to windows for privacy and heat reduction. Dealer pricing is typically 2-3x market rate.", category: "fees", tip: "Get tint installed independently for significant savings." },
  { term: "Ceramic Coating", definition: "A liquid polymer that bonds with paint for long-term protection. Dealer price: $1,500+. Real cost: $500-800.", category: "fees", tip: "Find a reputable detailer for professional-grade ceramic coating." },
  { term: "LoJack", definition: "A stolen vehicle recovery system. Being replaced by smartphone tracking in modern cars.", category: "fees", tip: "Many cars have built-in tracking - LoJack may be redundant." },
  { term: "Key Replacement Insurance", definition: "Coverage for lost or stolen key fobs. Costs dealers little but charged at $300-$500.", category: "fees", tip: "Check if your auto insurance or credit card covers this." },
  { term: "Tire and Wheel Protection", definition: "Insurance covering damage to tires and wheels. Rarely pays out enough to justify cost.", category: "fees", tip: "The math rarely works - fix issues as they occur instead." },
  { term: "Prepaid Maintenance", definition: "Paying upfront for scheduled maintenance. Sounds good but usually costs more than paying as you go.", category: "fees", tip: "Calculate the actual cost per service - it's usually a bad deal." },
  { term: "Dealer Prep Fee", definition: "A fee for 'preparing' the car for sale. This is already in the invoice price - it's double-dipping.", category: "fees", tip: "Always refuse - this is part of their normal process." },
  { term: "ADM", definition: "Additional Dealer Markup - extra profit added to high-demand vehicles. Same as market adjustment.", category: "fees", tip: "Never pay ADM - find another dealer or wait." },
  
  // Vehicle Info
  { term: "VIN", definition: "Vehicle Identification Number - a unique 17-character code identifying every vehicle. Used for history reports.", category: "vehicle", tip: "Always run a VIN check before buying any used vehicle." },
  { term: "Trim Level", definition: "Different versions of the same model with varying features (e.g., LX, EX, Touring). Higher trims cost more.", category: "vehicle", tip: "Mid-level trims often offer the best value." },
  { term: "CPO", definition: "Certified Pre-Owned - used vehicles that meet manufacturer standards with extended warranty.", category: "vehicle", tip: "CPO provides peace of mind but verify the inspection report." },
  { term: "Clean Title", definition: "A vehicle with no major damage, flood, or salvage history on record.", category: "vehicle", tip: "Never buy without a clean title unless you're an expert." },
  { term: "Salvage Title", definition: "A vehicle that was totaled by insurance and repaired. Significantly reduces value.", category: "vehicle", tip: "Avoid salvage titles - financing and insurance are difficult." },
  { term: "Carfax", definition: "A vehicle history report showing accidents, ownership, and service records.", category: "vehicle", tip: "Always get a Carfax AND a pre-purchase inspection." },
  { term: "Depreciation", definition: "The decrease in a vehicle's value over time. New cars lose 20-30% in year one.", category: "vehicle", tip: "Buy 2-3 year old cars to avoid the steepest depreciation." },
  { term: "Powertrain", definition: "The engine, transmission, and drivetrain components. Powertrain warranties cover these.", category: "vehicle", tip: "Powertrain issues are the most expensive to repair." },
  { term: "Odometer Rollback", definition: "Illegal tampering to show lower mileage than actual. Check Carfax for mileage discrepancies.", category: "vehicle", tip: "Compare Carfax mileage history to current odometer reading." },
  { term: "Lemon", definition: "A vehicle with recurring defects that can't be fixed. Lemon laws protect buyers of defective new cars.", category: "vehicle", tip: "Document all repair visits - they're evidence for lemon law claims." },
  { term: "Lemon Law", definition: "State laws protecting buyers of defective new vehicles. Requirements vary by state.", category: "vehicle", tip: "Check your state's specific requirements - usually 3-4 repair attempts." },
  { term: "As-Is", definition: "Sold without warranty - buyer assumes all risk. Common with used cars from private sellers.", category: "vehicle", tip: "Always get a pre-purchase inspection before buying as-is." },
  { term: "Buyer's Guide", definition: "A federally required window sticker on used cars showing warranty status and known issues.", category: "vehicle", tip: "Read this carefully - it's a legal disclosure of the car's condition." },
  { term: "Pre-Purchase Inspection", definition: "Having a mechanic inspect a used car before buying. Costs $100-200 but can save thousands.", category: "vehicle", tip: "Never skip this step - it's the best money you'll spend." },
  { term: "Window Sticker", definition: "The manufacturer's label showing MSRP, features, and fuel economy. Also called the Monroney sticker.", category: "vehicle", tip: "Request the original window sticker for used cars to verify features." },
  { term: "Monroney Sticker", definition: "The official name for the window sticker, required by federal law since 1958.", category: "vehicle", tip: "Use this to compare vehicles and verify installed options." },
  { term: "Demo Vehicle", definition: "A car that's been driven by dealership employees or loaner customers. Should be significantly discounted.", category: "vehicle", tip: "Demos should be priced 10-15% below MSRP at minimum." },
  { term: "Program Car", definition: "A vehicle previously used as a rental or fleet car. Higher miles but usually well-maintained.", category: "vehicle", tip: "Program cars can be great deals - maintenance is typically documented." },
  { term: "Flood Damage", definition: "Vehicles damaged by water/flooding. Can cause long-term electrical and mechanical issues.", category: "vehicle", tip: "Check VIN history and look for water stains, musty smells, rust." },
  { term: "Frame Damage", definition: "Structural damage to the vehicle's frame from an accident. Compromises safety and reduces value.", category: "vehicle", tip: "Have a body shop inspect for frame damage before buying used." },
  
  // Insurance
  { term: "GAP Insurance", definition: "Guaranteed Asset Protection - pays the difference between your car's value and loan balance if totaled.", category: "insurance", tip: "Essential if you have less than 20% down payment." },
  { term: "Comprehensive Coverage", definition: "Insurance covering non-collision damage like theft, weather, and vandalism.", category: "insurance", tip: "Required for financed vehicles." },
  { term: "Collision Coverage", definition: "Insurance covering damage from accidents, regardless of fault.", category: "insurance", tip: "Required for financed vehicles." },
  { term: "Liability Coverage", definition: "Insurance covering damage you cause to others. The legal minimum requirement.", category: "insurance", tip: "Higher limits protect your assets - don't go minimum." },
  { term: "Deductible", definition: "The amount you pay out of pocket before insurance kicks in. Higher deductible = lower premium.", category: "insurance", tip: "Choose a deductible you can comfortably afford to pay." },
  { term: "Full Coverage", definition: "Not a real term - typically means liability + collision + comprehensive. Ask exactly what's included.", category: "insurance", tip: "Always ask for itemized coverage - 'full' means different things." },
  { term: "Uninsured Motorist", definition: "Coverage protecting you if hit by a driver without insurance. Critical in some states.", category: "insurance", tip: "Around 13% of drivers are uninsured - this coverage is important." },
  { term: "Personal Injury Protection", definition: "Coverage for medical expenses regardless of fault. Required in no-fault states.", category: "insurance", tip: "PIP covers you even if the accident was your fault." },
  { term: "Declared Value", definition: "The value you state your vehicle is worth for insurance purposes. Affects premiums and payouts.", category: "insurance", tip: "Be accurate - undervaluing means less payout if totaled." },
  { term: "Actual Cash Value", definition: "What your car is worth at the time of a claim, accounting for depreciation.", category: "insurance", tip: "ACV decreases over time - GAP insurance covers the difference." },
  
  // Negotiation
  { term: "Four Square", definition: "A dealer tactic using a four-box worksheet to confuse buyers and hide profit. A major red flag.", category: "negotiation", tip: "Refuse to negotiate using the four square - focus on OTD price." },
  { term: "Payment Packing", definition: "Hiding fees in your monthly payment without disclosure. Illegal but common.", category: "negotiation", tip: "Always verify line items match your agreed OTD price." },
  { term: "Bump", definition: "When a manager claims your deal wasn't approved and asks for more money. Often a bluff.", category: "negotiation", tip: "Be prepared to walk away - your deal was likely approved." },
  { term: "Lowball Offer", definition: "An intentionally low offer to start negotiations. Part of the game.", category: "negotiation", tip: "Start 10-15% below your target to leave room for negotiation." },
  { term: "Walk Away", definition: "Leaving the dealership without buying. Your most powerful negotiating tool.", category: "negotiation", tip: "Be willing to walk - dealers often call back with better offers." },
  { term: "F&I Office", definition: "Finance and Insurance office where you sign paperwork. Where most profit is made on add-ons.", category: "negotiation", tip: "Be prepared to say no repeatedly in F&I." },
  { term: "Dealer Holdback", definition: "A percentage of MSRP manufacturers pay dealers after sale. Hidden profit margin.", category: "negotiation", tip: "Dealers can profit even selling at invoice due to holdback." },
  { term: "Negotiate the Out-the-Door Price", definition: "The strategy of negotiating the total price including all fees, taxes, and add-ons rather than just the vehicle price.", category: "negotiation", tip: "This is the ONLY way to negotiate - never focus on monthly payment." },
  { term: "Best Price Guarantee", definition: "A dealer promise to beat competitors' prices. Often has fine print exceptions.", category: "negotiation", tip: "Get competitor quotes in writing before using price guarantees." },
  { term: "Internet Price", definition: "The price listed on dealer websites, often lower than lot price. Use this as your starting point.", category: "negotiation", tip: "Email multiple dealers for quotes - use the lowest as leverage." },
  { term: "Pencil", definition: "Dealer slang for the written offer sheet. They'll 'sharpen the pencil' to improve the deal.", category: "negotiation", tip: "Get everything in writing before celebrating any deal." },
  { term: "T.O.", definition: "Turn Over - when a salesperson brings in a manager to close the deal. Expect more pressure.", category: "negotiation", tip: "Stay calm during T.O. - it means they want to sell." },
  { term: "Be-Back Bus", definition: "Dealer slang for customers who say they'll return but never do. Used to pressure immediate decisions.", category: "negotiation", tip: "Being on the 'be-back bus' is fine - take your time." },
  { term: "Grinder", definition: "A buyer who negotiates hard on every detail. Dealers dislike but respect grinders.", category: "negotiation", tip: "Be a grinder - negotiate every line item on the bill of sale." },
  { term: "Laydown", definition: "Dealer term for a buyer who accepts the first offer without negotiating. Don't be a laydown.", category: "negotiation", tip: "Never accept the first offer - there's always room to negotiate." },
  { term: "Mini Deal", definition: "A sale with minimal profit for the dealer. They'll try to make it up in F&I.", category: "negotiation", tip: "Mini deals are wins for you - stay strong in F&I." },
  { term: "Spiff", definition: "A bonus paid to salespeople for selling certain vehicles or add-ons. Motivates pushy behavior.", category: "negotiation", tip: "Know that salespeople have financial incentives to upsell you." },
  
  // Dealer Tactics
  { term: "Bait and Switch", definition: "Advertising a car at a low price that's 'just sold' to get you in the door. Illegal but common.", category: "tactics", tip: "Confirm vehicle availability before visiting any dealer." },
  { term: "Spot Delivery", definition: "Taking the car home before financing is finalized. Dealer may call demanding more money later.", category: "tactics", tip: "Wait for final financing approval before driving off the lot." },
  { term: "Yo-Yo Financing", definition: "When a dealer calls after purchase claiming financing fell through and demands new terms.", category: "tactics", tip: "Get all financing finalized before taking delivery." },
  { term: "Payment Focus", definition: "A tactic where dealers negotiate monthly payment instead of total price to hide true cost.", category: "tactics", tip: "Never answer 'What monthly payment do you want?' - focus on OTD." },
  { term: "Trade-In Lowball", definition: "Offering below-market value for your trade, then making up the difference elsewhere in the deal.", category: "tactics", tip: "Know your trade's value from multiple sources before negotiating." },
  { term: "Good Cop Bad Cop", definition: "Salesperson acts friendly while manager plays hardball. Classic pressure technique.", category: "tactics", tip: "Recognize the game - both are working to maximize dealer profit." },
  { term: "The Grind", definition: "Wearing buyers down with hours of back-and-forth to get them to agree to anything.", category: "tactics", tip: "Set time limits - leave if negotiations drag on too long." },
  { term: "Limited Time Offer", definition: "Creating artificial urgency with 'today only' deals. Almost always available tomorrow.", category: "tactics", tip: "Real deals don't expire - take your time." },
  { term: "Manager Special", definition: "A price supposedly authorized only by the manager. Usually just a negotiating tactic.", category: "tactics", tip: "Every price is a 'manager special' - keep negotiating." },
  { term: "Packed Payment", definition: "A quoted monthly payment that includes hidden products like warranties or insurance.", category: "tactics", tip: "Always ask for a line-item breakdown of your payment." },
  { term: "The Puppy Dog Close", definition: "Letting you take the car home overnight hoping you'll emotionally commit.", category: "tactics", tip: "Stay objective - don't let a test drive turn into ownership." },
  { term: "Fear Close", definition: "Creating fear that another buyer is interested or the deal won't last.", category: "tactics", tip: "Call the bluff - good deals don't disappear that fast." },
  { term: "Assumed Close", definition: "Acting like you've already agreed to buy and moving straight to paperwork.", category: "tactics", tip: "Slow down and explicitly agree to terms before signing anything." },
  { term: "If I Could, Would You", definition: "A technique where dealers propose hypothetical terms to gauge your commitment level.", category: "tactics", tip: "Don't commit to hypotheticals - get real numbers first." },
  { term: "The Take Away", definition: "Threatening to withdraw a deal to pressure you into accepting quickly.", category: "tactics", tip: "Call their bluff - if they take it away, find another dealer." },
  
  // Maintenance
  { term: "Scheduled Maintenance", definition: "Regular service intervals recommended by the manufacturer (oil changes, inspections, etc.).", category: "maintenance", tip: "Follow the owner's manual, not dealer 'recommendations.'" },
  { term: "Severe Service Schedule", definition: "More frequent maintenance for cars driven in extreme conditions, towing, or stop-and-go traffic.", category: "maintenance", tip: "Most drivers qualify for normal schedule - don't over-maintain." },
  { term: "Timing Belt", definition: "A critical engine component that should be replaced at specific intervals (60-100k miles).", category: "maintenance", tip: "Factor timing belt replacement into used car buying decisions." },
  { term: "Timing Chain", definition: "A more durable alternative to timing belts that typically lasts the life of the engine.", category: "maintenance", tip: "Check if a vehicle has a chain vs belt - chains need less maintenance." },
  { term: "Transmission Flush", definition: "Replacing all transmission fluid. Often unnecessary and potentially harmful on older vehicles.", category: "maintenance", tip: "Many mechanics recommend drain-and-fill instead of full flush." },
  { term: "Brake Pad Replacement", definition: "Replacing worn friction material on brakes. Typical life is 25,000-65,000 miles.", category: "maintenance", tip: "Get brakes inspected at every oil change to avoid surprises." },
  { term: "Brake Rotor", definition: "The disc that brake pads clamp onto. May need resurfacing or replacement with pads.", category: "maintenance", tip: "Rotors don't always need replacement - ask for measurements." },
  { term: "Alignment", definition: "Adjusting wheel angles for proper tire wear and handling. Needed after hitting curbs or potholes.", category: "maintenance", tip: "Get alignment checked if you notice uneven tire wear or pulling." },
  { term: "Tire Rotation", definition: "Moving tires between positions to ensure even wear. Recommended every 5,000-7,500 miles.", category: "maintenance", tip: "Many tire shops offer free rotations with purchase." },
  { term: "Cabin Air Filter", definition: "Filters air entering the passenger compartment. Easy DIY replacement for $15-30.", category: "maintenance", tip: "Dealers charge $50-80 for a 5-minute DIY job." },
  { term: "Engine Air Filter", definition: "Filters air entering the engine. Simple replacement, often overpriced at dealers.", category: "maintenance", tip: "Check YouTube for your car - usually a 2-minute DIY job." },
  { term: "Coolant Flush", definition: "Replacing the engine's cooling fluid. Needed every 30,000-60,000 miles depending on type.", category: "maintenance", tip: "Use the correct coolant type - mixing can cause problems." },
  { term: "Spark Plug Replacement", definition: "Replacing ignition components. Modern plugs last 60,000-100,000 miles.", category: "maintenance", tip: "Check owner's manual - don't replace earlier than needed." },
  { term: "Battery Life", definition: "Car batteries typically last 3-5 years. Hot climates shorten lifespan.", category: "maintenance", tip: "Have battery tested annually after year 3." },
  { term: "Check Engine Light", definition: "Dashboard indicator for engine or emissions issues. Requires diagnostic scan to identify.", category: "maintenance", tip: "Auto parts stores will scan codes for free." },
  
  // Vehicle Features
  { term: "AWD", definition: "All-Wheel Drive - power goes to all four wheels automatically. Good for varied conditions.", category: "features", tip: "AWD adds cost and reduces fuel economy - consider if you need it." },
  { term: "4WD", definition: "Four-Wheel Drive - selectable system for off-road or severe weather. Common on trucks/SUVs.", category: "features", tip: "4WD is for off-road; AWD is better for daily driving in weather." },
  { term: "FWD", definition: "Front-Wheel Drive - power goes to front wheels only. Most efficient and affordable.", category: "features", tip: "FWD with good tires handles well in most conditions." },
  { term: "RWD", definition: "Rear-Wheel Drive - power goes to rear wheels. Better for performance but worse in snow.", category: "features", tip: "RWD cars need extra caution (and weight) in winter conditions." },
  { term: "CVT", definition: "Continuously Variable Transmission - seamless gear changes. More fuel efficient but different feel.", category: "features", tip: "CVTs are reliable in most brands - avoid early Nissan CVTs." },
  { term: "DSG", definition: "Direct-Shift Gearbox - an automated manual transmission. Quick shifts but can be expensive to repair.", category: "features", tip: "DSGs need fluid changes every 40k miles - factor this in." },
  { term: "Turbocharger", definition: "A device that increases engine power using exhaust gases. More power from smaller engines.", category: "features", tip: "Turbos require premium fuel and more maintenance in some cars." },
  { term: "Supercharger", definition: "An engine-driven compressor that increases power. Instant response but reduces fuel economy.", category: "features", tip: "Superchargers are mechanically simpler than turbos." },
  { term: "Adaptive Cruise Control", definition: "Cruise control that automatically adjusts speed based on traffic ahead.", category: "features", tip: "One of the most useful driver assistance features available." },
  { term: "Lane Keep Assist", definition: "A system that helps keep the vehicle centered in its lane.", category: "features", tip: "Helpful but not a substitute for attentive driving." },
  { term: "Blind Spot Monitoring", definition: "Sensors that alert you to vehicles in your blind spot. Reduces lane-change accidents.", category: "features", tip: "One of the most valuable safety features - highly recommended." },
  { term: "Automatic Emergency Braking", definition: "System that automatically applies brakes if a collision is imminent.", category: "features", tip: "Now standard on most new vehicles - don't buy without it." },
  { term: "Apple CarPlay", definition: "System allowing iPhone integration with car's display for maps, music, and messaging.", category: "features", tip: "Check wireless vs wired CarPlay - wireless is more convenient." },
  { term: "Android Auto", definition: "Google's system for Android phone integration with car displays.", category: "features", tip: "Similar to CarPlay - choose based on your phone preference." },
  { term: "Heads-Up Display", definition: "Projects speed and navigation info onto the windshield. Reduces eyes-off-road time.", category: "features", tip: "Once you try HUD, you'll miss it in cars without it." },
  { term: "Panoramic Sunroof", definition: "A large glass roof panel, often extending over rear seats. Adds openness but weight and leak risk.", category: "features", tip: "Pano roofs can develop leaks - check used car headliners for stains." },
  { term: "Run-Flat Tires", definition: "Tires that can drive short distances after puncture. Eliminates spare tire but ride is harsher.", category: "features", tip: "Run-flats cost more to replace and can't always be repaired." },
  { term: "Towing Capacity", definition: "Maximum weight a vehicle can safely pull. Exceeding it is dangerous and voids warranty.", category: "features", tip: "Include trailer tongue weight in your calculations." },
  { term: "Payload Capacity", definition: "Maximum weight that can be carried inside or in the bed of a vehicle.", category: "features", tip: "Passengers + cargo + tongue weight must stay under payload limit." },
  { term: "Ground Clearance", definition: "Distance between the lowest point of the vehicle and the ground. Important for off-road.", category: "features", tip: "Higher clearance helps with snow and rough roads but hurts fuel economy." },
];

export default function DealRoom() {
  const [activeTab, setActiveTab] = useState("copilot");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  
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
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDE_PANEL_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  });
  const { toast } = useToast();

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

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const filteredTerms = glossaryTerms
    .filter((item) => {
      const matchesSearch = 
        item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesLetter = !selectedLetter || item.term.toUpperCase().startsWith(selectedLetter);
      return matchesSearch && matchesCategory && matchesLetter;
    })
    .sort((a, b) => a.term.localeCompare(b.term));

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
    });
    setScoreResult(deal.score_result || null);
    clearMessages();
    setActiveTab("copilot");
  };

  const handleNewDeal = () => {
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
            <TabsTrigger value="scripts" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">What To Say</span>
            </TabsTrigger>
            <TabsTrigger value="glossary" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Glossary</span>
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
                      <Button variant="outline" size="sm" onClick={() => setActiveTab("glossary")}>
                        <BookOpen className="h-4 w-4 mr-2" />
                        View Full Glossary
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                          onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                  onGlossaryClick={() => setActiveTab("glossary")}
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
              {/* Fee Breakdown for context */}
              <FeeBreakdown
                docFee={parseNumber(dealData.docFee)}
                dealerFee={parseNumber(dealData.dealerFee)}
                addOns={parseNumber(dealData.addOns)}
                taxes={parseNumber(dealData.taxes)}
                registration={parseNumber(dealData.registration)}
                askingPrice={parseNumber(dealData.askingPrice) || parseNumber(dealData.negotiatedPrice) || 25000}
                onGlossaryClick={() => setActiveTab("glossary")}
              />
              
              {/* Negotiation Scripts */}
              <WhatToSayNext 
                dealData={dealData} 
                scoreResult={scoreResult} 
              />
            </div>
          </TabsContent>

          {/* GLOSSARY TAB */}
          <TabsContent value="glossary" className="animate-fade-in">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">Learn the Lingo</h2>
                <p className="text-muted-foreground">Master car-buying terminology to negotiate like a pro</p>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search terms, definitions, or tips..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {glossaryCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {glossaryCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* A-Z Letter Filter */}
              <div className="flex flex-wrap gap-1 mb-6 p-3 rounded-xl bg-muted/50 border border-border">
                <button
                  onClick={() => setSelectedLetter(null)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-all ${
                    selectedLetter === null
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {alphabet.map((letter) => {
                  const hasTerms = glossaryTerms.some(t => t.term.toUpperCase().startsWith(letter));
                  return (
                    <button
                      key={letter}
                      onClick={() => setSelectedLetter(letter)}
                      disabled={!hasTerms}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-all ${
                        selectedLetter === letter
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : hasTerms
                            ? "bg-background text-muted-foreground hover:bg-background/80 hover:text-foreground"
                            : "bg-background/50 text-muted-foreground/30 cursor-not-allowed"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Results Count */}
              <p className="text-sm text-muted-foreground mb-4">
                Showing {filteredTerms.length} of {glossaryTerms.length} terms
              </p>

              {/* Terms Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {filteredTerms.map((item) => (
                  <div 
                    key={item.term} 
                    className="p-5 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-foreground text-lg">{item.term}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize whitespace-nowrap">
                        {glossaryCategories.find(c => c.id === item.category)?.label || item.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{item.definition}</p>
                    {item.tip && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <span className="text-primary font-bold text-xs mt-0.5">TIP</span>
                        <p className="text-xs text-foreground">{item.tip}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredTerms.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No terms found matching your search.</p>
                  <Button variant="ghost" className="mt-2" onClick={() => { setSearchTerm(""); setSelectedCategory("all"); setSelectedLetter(null); }}>
                    Clear filters
                  </Button>
                </div>
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
                            onGlossaryClick={() => setActiveTab("glossary")}
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
