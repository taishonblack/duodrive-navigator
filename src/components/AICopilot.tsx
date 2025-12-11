import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X, Send, Bot, User, Sparkles, RotateCcw, ArrowRight } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCopilotChat } from "@/hooks/useCopilotChat";
import { parseExtractedDealData, ExtractedDealData } from "@/hooks/useDealExtraction";

const EXTRACTED_DEAL_KEY = "duodrive_extracted_deal";

export function AICopilot() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hasExtractedData, setHasExtractedData] = useState(false);
  const [input, setInput] = useState("");
  const [showAnimation, setShowAnimation] = useState(true);
  
  // Use shared chat hook for synced messages
  const { messages, setMessages, refreshWelcome, clearMessages, isLoading, setIsLoading } = useCopilotChat();

  // Hide the floating copilot on Deal Room (it's integrated there)
  const isDealRoom = location.pathname === "/deal-room";

  // Stop animation after 1 minute
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 60000); // 1 minute

    return () => clearTimeout(timer);
  }, []);

  // Refresh greeting when opening (only run when isOpen changes to true)
  useEffect(() => {
    if (isOpen) {
      refreshWelcome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Store extracted deal data for syncing with Deal Room
  const storeExtractedDeal = (extractedData: ExtractedDealData) => {
    try {
      // Get existing extracted data and merge
      const existing = localStorage.getItem(EXTRACTED_DEAL_KEY);
      const existingData = existing ? JSON.parse(existing) : {};
      const merged = { ...existingData, ...extractedData };
      localStorage.setItem(EXTRACTED_DEAL_KEY, JSON.stringify(merged));
    } catch (e) {
      console.error("Failed to store extracted deal:", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: "user" as const,
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          dealContext: {},
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
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
              // Parse and show clean content (without extraction markers)
              const { cleanContent } = parseExtractedDealData(assistantContent);
              setMessages(prev => {
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

      // After streaming is complete, extract deal data (store silently, no popup)
      const { extractedData } = parseExtractedDealData(assistantContent);
      if (extractedData) {
        storeExtractedDeal(extractedData);
        setHasExtractedData(true);
      }
    } catch (error) {
      console.error("Chat error:", error);
      // Fallback response on error
      const fallbackMessage = {
        role: "assistant" as const,
        content: "I'm having trouble connecting right now. For the best experience, head to the **Deal Room** where I can analyze your specific deal!",
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render on Deal Room
  if (isDealRoom) return null;

  return (
    <>
      {/* Chat Bubble Button with attention animation */}
      <button
        onClick={() => {
          setIsOpen(true);
          setShowAnimation(false); // Stop animation when clicked
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated hover:scale-105 transition-all duration-200",
          isOpen && "hidden",
          showAnimation && "animate-attention-pulse"
        )}
      >
        <Sparkles className={cn(
          "h-6 w-6",
          showAnimation && "animate-wiggle"
        )} />
      </button>

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-2xl bg-card border border-border shadow-elevated transition-all duration-300",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI Copilot</h3>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                onClick={clearMessages}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Clear conversation"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  message.role === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {message.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2",
                  message.role === "assistant"
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {/* Show Deal Room link on the last assistant message if data was extracted */}
                {message.role === "assistant" && 
                 index === messages.length - 1 && 
                 hasExtractedData && 
                 !isLoading && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      navigate("/deal-room");
                    }}
                    className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    Go to Deal Room <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or paste your deal information..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
