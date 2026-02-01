import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Search } from "lucide-react";
import { glossaryCategories, glossaryTerms } from "@/data/glossaryTerms";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function Glossary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [highlightedTerm, setHighlightedTerm] = useState<string | null>(null);
  const termRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Handle URL param for term navigation
  useEffect(() => {
    const termParam = searchParams.get("term");
    if (termParam) {
      setSearchTerm(termParam);
      setHighlightedTerm(termParam);
      setSelectedCategory("all");
      setSelectedLetter(null);
      
      // Clear the URL param after processing
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 100);

      // Scroll to term after a brief delay
      setTimeout(() => {
        const termElement = termRefs.current[termParam];
        if (termElement) {
          termElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);

      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedTerm(null);
      }, 3000);
    }
  }, [searchParams, setSearchParams]);

  const filteredTerms = glossaryTerms.filter((term) => {
    const matchesSearch = searchTerm === "" || 
      term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.tip.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || term.category === selectedCategory;
    
    const matchesLetter = selectedLetter === null || 
      term.term.toUpperCase().startsWith(selectedLetter);
    
    return matchesSearch && matchesCategory && matchesLetter;
  });

  return (
    <Layout>
      <SEO 
        title="Car Buying Glossary | DuoDrive"
        description="Master car-buying terminology with our comprehensive glossary of 130+ terms. Learn about financing, fees, negotiation tactics, and more."
      />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <BookOpen className="h-4 w-4" />
            {glossaryTerms.length}+ Terms
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Car Buying Glossary</h1>
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
              ref={(el) => { termRefs.current[item.term] = el; }}
              className={`p-5 rounded-2xl bg-card border shadow-card hover:shadow-elevated transition-all duration-300 ${
                highlightedTerm === item.term
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border"
              }`}
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
