import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreRing } from "@/components/ScoreRing";
import { PillarCard } from "@/components/PillarCard";
import { Upload, Calculator, Bot, BookOpen, BarChart3, TrendingDown, Wrench, Shield, DollarSign, Heart, Search, Loader2, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const glossaryTerms = [
  { term: "APR", definition: "Annual Percentage Rate - the yearly interest rate charged on borrowed money." },
  { term: "Doc Fee", definition: "Documentation fee charged by dealers for processing paperwork." },
  { term: "GAP Insurance", definition: "Coverage that pays the difference between your car's value and loan balance if totaled." },
  { term: "MSRP", definition: "Manufacturer's Suggested Retail Price - the sticker price set by the manufacturer." },
  { term: "Residual Value", definition: "The predicted value of a vehicle at the end of a lease term." },
  { term: "Trade-In Value", definition: "What a dealer offers for your current vehicle toward a new purchase." },
  { term: "VIN", definition: "Vehicle Identification Number - a unique 17-character code for every vehicle." },
  { term: "Dealer Add-Ons", definition: "Extra products or services dealers add to increase profit (often overpriced)." },
];

interface ScoreResult {
  overall: number;
  pillars: {
    depreciation: { score: number; details: string };
    reliability: { score: number; details: string };
    safety: { score: number; details: string };
    dealHealth: { score: number; details: string };
    affordability: { score: number; details: string };
  };
  recommendation: string;
  monthlyPayment: number;
  totalCost: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function DealRoom() {
  const [activeTab, setActiveTab] = useState("deal");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { toast } = useToast();
  
  const [dealData, setDealData] = useState({
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
  });

  const filteredTerms = glossaryTerms.filter(
    (item) =>
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (field: string, value: string) => {
    setDealData((prev) => ({ ...prev, [field]: value }));
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

      const fieldsExtracted = Object.values(extracted).filter(v => v !== null).length;
      toast({
        title: "Quote Extracted!",
        description: `Found ${fieldsExtracted} fields. Please review and fill in any missing details.`,
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
      const payload = {
        year: parseInt(dealData.year) || new Date().getFullYear(),
        make: dealData.make,
        model: dealData.model || "Unknown",
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
      };

      const { data, error } = await supabase.functions.invoke('duodrive-score', {
        body: payload,
      });

      if (error) throw error;
      
      setScoreResult(data);
      setActiveTab("overview");
      toast({
        title: "Score Calculated!",
        description: `Your DuoDrive Score is ${data.overall}`,
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

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    let assistantContent = "";

    try {
      const dealContext = {
        year: dealData.year,
        make: dealData.make,
        model: dealData.model,
        askingPrice: dealData.askingPrice,
        apr: dealData.apr,
        term: dealData.term,
        monthlyIncome: dealData.monthlyIncome,
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
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            // Incomplete JSON, continue
          }
        }
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Deal Room</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your deal details and let DuoDrive analyze it for you.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted rounded-xl">
            <TabsTrigger value="deal" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">The Deal</span>
            </TabsTrigger>
            <TabsTrigger value="calculator" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calculator</span>
            </TabsTrigger>
            <TabsTrigger value="copilot" className="flex items-center gap-2 py-3 data-[state=active]:bg-card data-[state=active]:shadow-soft rounded-lg">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Copilot</span>
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
                    <Input id="year" placeholder="2024" value={dealData.year} onChange={(e) => handleInputChange("year", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="make">Make</Label>
                    <Input id="make" placeholder="Honda" value={dealData.make} onChange={(e) => handleInputChange("make", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" placeholder="Accord" value={dealData.model} onChange={(e) => handleInputChange("model", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trim">Trim</Label>
                    <Input id="trim" placeholder="EX-L" value={dealData.trim} onChange={(e) => handleInputChange("trim", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mileage">Mileage</Label>
                    <Input id="mileage" placeholder="15,000" value={dealData.mileage} onChange={(e) => handleInputChange("mileage", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vin">VIN</Label>
                    <Input id="vin" placeholder="Optional" value={dealData.vin} onChange={(e) => handleInputChange("vin", e.target.value)} />
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
                    <Input id="askingPrice" placeholder="$32,000" value={dealData.askingPrice} onChange={(e) => handleInputChange("askingPrice", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="negotiatedPrice">Negotiated Price</Label>
                    <Input id="negotiatedPrice" placeholder="Optional" value={dealData.negotiatedPrice} onChange={(e) => handleInputChange("negotiatedPrice", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="downPayment">Down Payment</Label>
                    <Input id="downPayment" placeholder="$5,000" value={dealData.downPayment} onChange={(e) => handleInputChange("downPayment", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tradeIn">Trade-In Value</Label>
                    <Input id="tradeIn" placeholder="$8,000" value={dealData.tradeIn} onChange={(e) => handleInputChange("tradeIn", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apr">APR (%)</Label>
                    <Input id="apr" placeholder="6.5" value={dealData.apr} onChange={(e) => handleInputChange("apr", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="term">Term (months)</Label>
                    <Select value={dealData.term} onValueChange={(value) => handleInputChange("term", value)}>
                      <SelectTrigger>
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
                    <Input id="docFee" placeholder="$499" value={dealData.docFee} onChange={(e) => handleInputChange("docFee", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealerFee">Dealer Fee</Label>
                    <Input id="dealerFee" placeholder="$0" value={dealData.dealerFee} onChange={(e) => handleInputChange("dealerFee", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addOns">Add-Ons</Label>
                    <Input id="addOns" placeholder="$0" value={dealData.addOns} onChange={(e) => handleInputChange("addOns", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxes">Est. Taxes</Label>
                    <Input id="taxes" placeholder="$2,400" value={dealData.taxes} onChange={(e) => handleInputChange("taxes", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="registration">Registration</Label>
                    <Input id="registration" placeholder="$350" value={dealData.registration} onChange={(e) => handleInputChange("registration", e.target.value)} />
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
                  Upload a dealer's quote (PDF or image) and our AI will extract the numbers for you.
                </p>
                <label className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer block ${
                  isExtracting ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileUpload}
                    disabled={isExtracting}
                    className="hidden"
                  />
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
                      <p className="text-sm text-foreground font-medium">
                        Extracting deal details...
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        AI is reading your quote
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports JPG, PNG, WebP, PDF up to 10MB
                      </p>
                    </>
                  )}
                </label>
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
            <div className="max-w-2xl mx-auto p-8 rounded-2xl bg-card border border-border shadow-card">
              <h2 className="text-2xl font-semibold text-foreground mb-6 text-center">
                Payment Calculator
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehicle Price</Label>
                    <Input placeholder="$32,000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input placeholder="$5,000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trade-In</Label>
                    <Input placeholder="$0" />
                  </div>
                  <div className="space-y-2">
                    <Label>APR (%)</Label>
                    <Input placeholder="6.5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan Term</Label>
                    <Select defaultValue="60">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                        <SelectItem value="72">72 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Est. Tax Rate (%)</Label>
                    <Input placeholder="8.5" />
                  </div>
                </div>

                <Button className="w-full" size="lg">
                  Calculate Payment
                </Button>

                <div className="p-6 rounded-xl bg-muted text-center">
                  <p className="text-sm text-muted-foreground">Estimated Monthly Payment</p>
                  <p className="text-4xl font-bold text-foreground mt-2">$487</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total Interest: $2,220 | Total Cost: $29,220
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI COPILOT TAB */}
          <TabsContent value="copilot" className="animate-fade-in">
            <div className="max-w-3xl mx-auto p-8 rounded-2xl bg-card border border-border shadow-card">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">AI Copilot</h2>
                  <p className="text-sm text-muted-foreground">Your car buying assistant</p>
                </div>
              </div>
              
              {/* Chat Messages */}
              <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                {chatMessages.length === 0 ? (
                  <div className="p-4 rounded-xl bg-muted">
                    <p className="text-sm text-foreground">
                      Hi! I'm your DuoDrive AI Copilot. I can help you:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <li>• Understand any part of your deal</li>
                      <li>• Explain fees and what they mean</li>
                      <li>• Spot potential red flags</li>
                      <li>• Suggest negotiation strategies</li>
                      <li>• Answer questions about your DuoDrive Score</li>
                    </ul>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
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
                  ))
                )}
                {isChatLoading && chatMessages[chatMessages.length - 1]?.content === '' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input 
                  placeholder="Ask me anything about your deal..." 
                  className="flex-1" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  disabled={isChatLoading}
                />
                <Button onClick={sendChatMessage} disabled={isChatLoading || !chatInput.trim()}>
                  {isChatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </Button>
              </div>
              
              {scoreResult && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  AI has access to your DuoDrive Score ({scoreResult.overall}) and deal details
                </p>
              )}
            </div>
          </TabsContent>

          {/* GLOSSARY TAB */}
          <TabsContent value="glossary" className="animate-fade-in">
            <div className="max-w-3xl mx-auto">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search terms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="space-y-4">
                {filteredTerms.map((item) => (
                  <div key={item.term} className="p-4 rounded-xl bg-card border border-border shadow-card">
                    <h3 className="font-semibold text-foreground">{item.term}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.definition}</p>
                  </div>
                ))}
              </div>
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
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {scoreResult.recommendation}
                  </p>
                  <Button variant="outline" className="w-full mt-4">
                    Talk to a Coach
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
