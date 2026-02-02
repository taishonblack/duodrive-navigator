import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Bot, User, Send, Loader2, ExternalLink, X } from "lucide-react";
import { ChatMessage } from "@/hooks/useCopilotChat";
import { useHenryBroadcastPopout } from "@/hooks/useHenryBroadcast";
import ReactMarkdown from "react-markdown";

export default function HenryPopout() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dealContext, setDealContext] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Handle messages update from main tab
  const handleMessagesUpdate = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    setIsConnected(true);
  }, []);

  // Handle deal context update from main tab
  const handleDealContextUpdate = useCallback((newContext: Record<string, string>) => {
    setDealContext(newContext);
  }, []);

  // Handle loading state update from main tab
  const handleLoadingStateUpdate = useCallback((loading: boolean) => {
    setIsLoading(loading);
  }, []);

  const { sendMessage, focusMain, notifyClose, isConnected: channelConnected } = useHenryBroadcastPopout({
    onMessagesUpdate: handleMessagesUpdate,
    onDealContextUpdate: handleDealContextUpdate,
    onLoadingStateUpdate: handleLoadingStateUpdate,
  });

  // Auto-scroll when messages change
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, isLoading]);

  // Set window title based on deal context
  useEffect(() => {
    const vehicleInfo = [dealContext.year, dealContext.make, dealContext.model]
      .filter(Boolean)
      .join(" ");
    document.title = vehicleInfo ? `Henry — ${vehicleInfo}` : "DuoDrive — Henry";
  }, [dealContext]);

  // Notify main when closing
  useEffect(() => {
    const handleBeforeUnload = () => {
      notifyClose();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [notifyClose]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    
    // Optimistically add user message locally
    const userMessage: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    
    // Send to main tab for processing
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReturnToMain = () => {
    focusMain();
    window.close();
  };

  const handleClose = () => {
    notifyClose();
    window.close();
  };

  // Show connection status if not yet connected
  if (!isConnected && channelConnected) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-4">
        <Bot className="h-12 w-12 text-primary mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Connecting to Deal Room...</h1>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Make sure you have the Deal Room open in another tab.
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!channelConnected) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-4">
        <Bot className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Connection Not Available</h1>
        <p className="text-sm text-muted-foreground text-center mb-4">
          Your browser doesn't support pop-out mode. Please use the Deal Room directly.
        </p>
        <Button onClick={() => window.location.href = "/deal-room"}>
          Go to Deal Room
        </Button>
      </div>
    );
  }

  const vehicleInfo = [dealContext.year, dealContext.make, dealContext.model]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">Henry</h1>
            {vehicleInfo && (
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {vehicleInfo}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-primary bg-primary/10 rounded-full">
            <span className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse" />
            Live
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReturnToMain}
            className="text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Deal Room
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <span
                    className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            className="flex-1 h-10"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="h-10 w-10 shrink-0"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Paste a listing or sticker photo in the main Deal Room tab.
        </p>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-secondary text-secondary-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-4 mb-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-4 mb-2">{children}</ol>
              ),
              li: ({ children }) => <li className="mb-1">{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
