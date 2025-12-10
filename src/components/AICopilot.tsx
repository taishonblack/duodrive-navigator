import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Get time-based greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const getInitialMessages = (): Message[] => [
  {
    id: "1",
    role: "assistant",
    content: `${getGreeting()}! 👋 I'm your DuoDrive AI Copilot. I'm here to help you navigate your car-buying journey with confidence.

How can I help you today?

• Paste a dealer quote and I'll analyze it
• Ask me to explain any fees or terms
• Get tips on negotiating your best deal

Would you like me to explain how DuoDrive works and the philosophy behind it?`,
  },
];

export function AICopilot() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);

  // Hide the floating copilot on Deal Room (it's integrated there)
  const isDealRoom = location.pathname === "/deal-room";

  // Stop animation after 1 minute
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 60000); // 1 minute

    return () => clearTimeout(timer);
  }, []);

  // Refresh greeting when opening
  useEffect(() => {
    if (isOpen && messages.length === 1) {
      setMessages(getInitialMessages());
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Check if user is asking about how DuoDrive works
    const lowerInput = input.toLowerCase();
    const isAskingAboutDuoDrive = 
      lowerInput.includes("how does") || 
      lowerInput.includes("philosophy") || 
      lowerInput.includes("explain") ||
      lowerInput.includes("what is duodrive") ||
      lowerInput.includes("yes") && messages.length <= 2;

    setTimeout(() => {
      let responseContent = "";
      
      if (isAskingAboutDuoDrive && messages.length <= 2) {
        responseContent = `DuoDrive was built on a simple belief: car buying should be simple, transparent, and stress-free.

🎯 **Our Philosophy:**
• We work exclusively for YOU — not dealerships
• No hidden fees, no pressure tactics
• Your DuoDrive Score is transparent and trustworthy
• Think of us as your financial advisor for car buying

📊 **How It Works:**
1. Paste your dealer quote or type the deal details
2. Our AI analyzes the pricing, fees, and terms
3. You get a DuoDrive Score (0-100) showing deal quality
4. We provide negotiation scripts and recommendations

Ready to analyze a deal? Head to the Deal Room or paste your quote here!`;
      } else {
        responseContent = "That's a great question! I'm here to help you understand your car deal better. For the best experience, head to the **Deal Room** where I can analyze your specific deal. Just paste your dealer quote and I'll break down every number for you!";
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
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
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
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
                <p className="text-sm">{message.content}</p>
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
              placeholder="Ask me anything..."
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
