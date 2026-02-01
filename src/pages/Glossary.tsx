import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search } from "lucide-react";

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
  { term: "Drivetrain", definition: "Components that deliver power to the wheels: FWD, RWD, AWD, or 4WD.", category: "vehicle", tip: "AWD adds cost and complexity - only get it if you need it." },
  { term: "Mileage", definition: "Total miles driven. Average is 12,000-15,000 per year. Higher mileage means lower value.", category: "vehicle", tip: "Calculate miles per year - highway miles are gentler than city." },
  { term: "Title Washing", definition: "Moving a salvage vehicle to a state with looser title laws to get a clean title. Illegal but happens.", category: "vehicle", tip: "Get a Carfax and check all 50 states for title history." },
  { term: "Lemon", definition: "A vehicle with significant defects that can't be fixed after multiple attempts.", category: "vehicle", tip: "Check if your state has lemon laws and know your rights." },
  { term: "Odometer Rollback", definition: "Illegally reducing the displayed mileage. A federal crime that still happens.", category: "vehicle", tip: "Compare Carfax mileage to the odometer reading." },
  { term: "Pre-Purchase Inspection", definition: "Having a mechanic inspect a used car before buying. Worth every penny.", category: "vehicle", tip: "Never skip the PPI - it costs $100-200 and saves thousands." },
  { term: "Recalls", definition: "Manufacturer notices for safety-related defects. Repairs are always free.", category: "vehicle", tip: "Check NHTSA.gov for open recalls on any vehicle." },
  { term: "TSB", definition: "Technical Service Bulletin - manufacturer guidance on known issues. Not a recall but helpful.", category: "vehicle", tip: "Search for TSBs to understand common problems with a model." },
  
  // Insurance
  { term: "Liability Insurance", definition: "Coverage for damage you cause to others. Required in most states.", category: "insurance", tip: "Get more than the minimum - medical bills can exceed limits." },
  { term: "Comprehensive Insurance", definition: "Covers non-collision damage: theft, weather, animals, vandalism.", category: "insurance", tip: "Required if you have a loan; optional once you own outright." },
  { term: "Collision Insurance", definition: "Covers damage to your car in an accident, regardless of fault.", category: "insurance", tip: "Drop it on older cars where repairs exceed value." },
  { term: "Gap Insurance", definition: "Pays the difference if your car is totaled and you owe more than it's worth.", category: "insurance", tip: "Essential for new cars and long loans; buy from your insurer, not dealer." },
  { term: "Deductible", definition: "The amount you pay before insurance kicks in. Higher deductible = lower premium.", category: "insurance", tip: "Set deductible to what you can afford out of pocket." },
  { term: "Premium", definition: "Your regular insurance payment, usually monthly or biannual.", category: "insurance", tip: "Shop around annually - loyalty rarely pays in insurance." },
  { term: "Full Coverage", definition: "Marketing term for liability + comprehensive + collision. Not an actual policy type.", category: "insurance", tip: "Know exactly what coverage you're getting, not just the term." },
  { term: "Uninsured Motorist Coverage", definition: "Protects you if hit by someone without insurance.", category: "insurance", tip: "Highly recommended - many drivers have no or minimal coverage." },
  
  // Negotiation
  { term: "Walk Away", definition: "Being willing to leave a deal. Your most powerful negotiating tool.", category: "negotiation", tip: "Never fall in love with a car - there's always another one." },
  { term: "Four Square", definition: "A dealer worksheet designed to confuse buyers by mixing trade, price, payment, and down payment.", category: "negotiation", tip: "Refuse to use it - negotiate one thing at a time." },
  { term: "Payment Packing", definition: "Adding products into your payment without clear disclosure.", category: "negotiation", tip: "Know your payment calculation before signing anything." },
  { term: "Spot Delivery", definition: "Taking the car home before financing is finalized. Can lead to yo-yo scams.", category: "negotiation", tip: "Don't take the car until financing is fully approved." },
  { term: "Yo-Yo Financing", definition: "Calling you back claiming financing fell through, then offering worse terms.", category: "negotiation", tip: "Get financing in writing before leaving with the car." },
  { term: "Lowball Offer", definition: "Starting with an offer significantly below your target. A valid negotiation strategy.", category: "negotiation", tip: "Start low, but be reasonable - insultingly low kills deals." },
  { term: "Anchor Price", definition: "The first number mentioned in a negotiation. Sets the range for the deal.", category: "negotiation", tip: "Let the dealer set the anchor, then negotiate down from there." },
  { term: "Best Price", definition: "A meaningless term dealers use. There's always room to negotiate further.", category: "negotiation", tip: "When they say 'best price,' ask for the manager." },
  { term: "Factory Incentives", definition: "Discounts and financing offers from the manufacturer. Often stackable.", category: "negotiation", tip: "Check manufacturer websites for current incentives." },
  { term: "Holdback", definition: "Money the manufacturer pays the dealer after sale. Typically 2-3% of MSRP.", category: "negotiation", tip: "Dealers can sell at invoice and still profit from holdback." },
  { term: "Dealer Cash", definition: "Hidden incentives from manufacturer to dealer. Not advertised to buyers.", category: "negotiation", tip: "Ask about dealer cash and incentives - they may share." },
  
  // Dealer Tactics
  { term: "The Closer", definition: "A manager brought in when you resist. Their job is to close the deal at any cost.", category: "tactics", tip: "Stay firm - closers are trained to find your weakness." },
  { term: "The Good Cop Bad Cop", definition: "One salesperson is friendly, another is tough. Classic manipulation tactic.", category: "tactics", tip: "Recognize the game and negotiate with facts, not emotions." },
  { term: "The Impending Event", definition: "Creating fake urgency: 'Sale ends today,' 'Another buyer is coming.'", category: "tactics", tip: "There's always another sale. Walk away if pressured." },
  { term: "The Turnover", definition: "Passing you to another person when negotiation stalls. Wears you down.", category: "tactics", tip: "Set a time limit. If they can't close in 2 hours, leave." },
  { term: "The Takeaway", definition: "Pretending to remove an offer or feature to make you want it more.", category: "tactics", tip: "If they take it away, let them. It'll come back." },
  { term: "The Puppy Dog Close", definition: "Letting you take the car home to get emotionally attached before signing.", category: "tactics", tip: "Never take a car home before the deal is final." },
  { term: "The Bump", definition: "Adding small amounts to the deal repeatedly. 'Just $10 more per month.'", category: "tactics", tip: "Calculate total cost, not monthly. $10/month = $600 on 60-month loan." },
  { term: "Desk Deal", definition: "When the salesperson 'goes to the desk' to talk to the manager. Often theater.", category: "tactics", tip: "Demand to speak directly to the decision-maker." },
  { term: "Red Pen Special", definition: "Fake crossed-out prices showing a 'discount' that never existed.", category: "tactics", tip: "Ignore their prices - know the market value before you arrive." },
  { term: "First Pencil", definition: "The dealer's initial offer, always inflated to leave room for negotiation.", category: "tactics", tip: "Never accept the first pencil - it's just the starting point." },
  
  // Maintenance
  { term: "Scheduled Maintenance", definition: "Regular service intervals recommended by the manufacturer.", category: "maintenance", tip: "Follow the owner's manual, not the dealer's aggressive schedule." },
  { term: "Synthetic Oil", definition: "Higher-quality oil that lasts longer. Required in many modern engines.", category: "maintenance", tip: "If your car requires synthetic, don't use conventional." },
  { term: "Timing Belt", definition: "Critical engine component that needs replacement every 60,000-100,000 miles.", category: "maintenance", tip: "Factor timing belt cost into used car negotiations." },
  { term: "Brake Pads", definition: "Friction material that wears down with use. Typical life: 25,000-70,000 miles.", category: "maintenance", tip: "Listen for squealing - it's the wear indicator." },
  { term: "Transmission Flush", definition: "Replacing all transmission fluid. Often unnecessary and can cause issues.", category: "maintenance", tip: "A simple drain and fill is usually safer than a flush." },
  { term: "Coolant Flush", definition: "Replacing engine coolant. Needed every 30,000-50,000 miles depending on type.", category: "maintenance", tip: "Use the coolant type specified in your owner's manual." },
  { term: "Tire Rotation", definition: "Moving tires to different positions for even wear. Every 5,000-7,500 miles.", category: "maintenance", tip: "Free at many tire shops with purchase - no need to pay dealer." },
  { term: "Alignment", definition: "Adjusting wheel angles for proper steering and tire wear.", category: "maintenance", tip: "Get an alignment when you buy new tires or hit something hard." },
  { term: "OEM Parts", definition: "Parts made by the original manufacturer. Higher quality but more expensive.", category: "maintenance", tip: "Aftermarket parts are fine for most repairs - save OEM for critical items." },
  
  // Features
  { term: "Adaptive Cruise Control", definition: "Cruise control that automatically adjusts speed based on traffic ahead.", category: "features", tip: "Great for highway driving but don't rely on it completely." },
  { term: "Blind Spot Monitoring", definition: "Sensors that warn you when a vehicle is in your blind spot.", category: "features", tip: "Helpful but always check mirrors and look before changing lanes." },
  { term: "Lane Keep Assist", definition: "System that steers the car back into the lane if you drift.", category: "features", tip: "Useful safety feature but not a substitute for attentive driving." },
  { term: "Forward Collision Warning", definition: "Alerts you when a collision is imminent. May include automatic braking.", category: "features", tip: "Look for models with automatic emergency braking included." },
  { term: "Apple CarPlay/Android Auto", definition: "Smartphone integration for navigation, music, and calls.", category: "features", tip: "Almost essential now - difficult to retrofit if not included." },
  { term: "Keyless Entry/Start", definition: "Lock, unlock, and start the car without removing the key from your pocket.", category: "features", tip: "Convenient but keep the fob away from doors to prevent theft." },
  { term: "Heads-Up Display", definition: "Projects speed and navigation onto the windshield.", category: "features", tip: "Nice to have but not essential - test it before buying." },
  { term: "Panoramic Sunroof", definition: "Large glass roof spanning front and rear seats.", category: "features", tip: "Can be hot and reduces headroom - make sure you like it." },
  { term: "Heated Seats", definition: "Electrically warmed seats for cold weather comfort.", category: "features", tip: "Worth having in cold climates - hard to add aftermarket." },
  { term: "Ventilated Seats", definition: "Seats with fans that push air through perforations for cooling.", category: "features", tip: "Game-changer in hot climates - worth paying extra for." },
  { term: "360-Degree Camera", definition: "Multiple cameras creating a bird's eye view around the vehicle.", category: "features", tip: "Extremely helpful for parking and tight spaces." },
  { term: "Wireless Charging", definition: "Pad that charges compatible phones without a cable.", category: "features", tip: "Can cause phones to overheat - wired may be more reliable." },
];

export default function Glossary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const filteredTerms = glossaryTerms
    .filter((item) => {
      const matchesSearch = 
        item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tip && item.tip.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesLetter = !selectedLetter || item.term.toUpperCase().startsWith(selectedLetter);
      return matchesSearch && matchesCategory && matchesLetter;
    })
    .sort((a, b) => a.term.localeCompare(b.term));

  return (
    <Layout>
      <SEO 
        title="Car Buying Glossary | DuoDrive"
        description="Master car-buying terminology with our comprehensive glossary. Learn 130+ terms to negotiate like a pro."
      />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Learn the Lingo</h1>
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
    </Layout>
  );
}
