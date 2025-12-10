import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Bot, X, Send, User, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface DealRoomCopilotProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  dealContext?: {
    year?: string;
    make?: string;
    model?: string;
    askingPrice?: string;
  };
}

export function DealRoomCopilot({
  messages,
  onSendMessage,
  isLoading,
  isOpen,
  onToggle,
  dealContext
}: DealRoomCopilotProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  // Show vehicle context if available
  const vehicleInfo = [dealContext?.year, dealContext?.make, dealContext?.model]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Collapsed State - Tab on the right edge */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 bg-primary text-primary-foreground px-3 py-4 rounded-l-xl shadow-elevated hover:bg-primary/90 transition-all duration-200 group"
        >
          <Bot className="h-5 w-5" />
          <ChevronLeft className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Expanded Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full z-50 w-96 max-w-[90vw] bg-card border-l border-border shadow-elevated transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">AI Copilot</h3>
              {vehicleInfo && (
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {vehicleInfo}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close copilot"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-10 w-10 text-primary mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Ask me anything about your deal!
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
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
                    "max-w-[80%] rounded-2xl px-4 py-2",
                    message.role === "assistant"
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))
          )}
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
          <div ref={messagesEndRef} />
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
              placeholder="Ask about your deal..."
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Overlay when open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
