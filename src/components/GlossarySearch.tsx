import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BookOpen, X, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { glossaryTerms, glossaryCategories } from "@/data/glossaryTerms";
import { cn } from "@/lib/utils";

interface GlossarySearchProps {
  className?: string;
}

export function GlossarySearch({ className }: GlossarySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const filteredTerms = search.trim()
    ? glossaryTerms.filter(
        (t) =>
          t.term.toLowerCase().includes(search.toLowerCase()) ||
          t.definition.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const getCategoryLabel = (categoryId: string) => {
    return glossaryCategories.find((c) => c.id === categoryId)?.label || categoryId;
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredTerms.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredTerms.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredTerms[selectedIndex]) {
      e.preventDefault();
      handleSelectTerm(filteredTerms[selectedIndex].term);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
    }
  };

  const handleSelectTerm = (term: string) => {
    navigate(`/glossary?term=${encodeURIComponent(term)}`);
    setIsOpen(false);
    setSearch("");
  };

  const handleOpenChange = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpenChange}
        className="h-9 w-9"
        aria-label="Search glossary"
      >
        <BookOpen className="h-4 w-4" />
      </Button>

      {/* Search Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border bg-background shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search car buying terms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="max-h-80">
            {filteredTerms.length > 0 ? (
              <div className="p-2">
                {filteredTerms.map((item, index) => (
                  <button
                    key={item.term}
                    onClick={() => handleSelectTerm(item.term)}
                    className={cn(
                      "w-full text-left p-3 rounded-md transition-colors",
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{item.term}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.definition}
                    </p>
                    {item.tip && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-primary">
                        <Lightbulb className="h-3 w-3" />
                        <span className="line-clamp-1">{item.tip}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : search.trim() ? (
              <div className="p-6 text-center text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No terms found for "{search}"</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    navigate("/glossary");
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="mt-2"
                >
                  Browse all terms →
                </Button>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Start typing to search 130+ terms</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    navigate("/glossary");
                    setIsOpen(false);
                  }}
                  className="mt-2"
                >
                  View full glossary →
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
