import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Plus, 
  Camera, 
  ImagePlus, 
  FileText,
  RotateCcw,
  LogIn,
  MoreHorizontal,
  Mail,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatMessage } from "@/hooks/useCopilotChat";
import ReactMarkdown from "react-markdown";
import { DealershipModeToggle } from "@/components/DealershipModeToggle";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { ChatHelperTips } from "@/components/ChatHelperTips";
import { DealershipQuickReplies as DealershipCheck } from "@/components/QuickReplyButtons";
import { DealershipQuickReplies } from "@/components/DealershipQuickReplies";
import { DealContext } from "@/config/dealershipQuickReplies";
import { useIsMobile } from "@/hooks/use-mobile";
import { TypewriterText } from "./TypewriterText";
import { ChatActionButtons, shouldShowActionButtons } from "./ChatActionButtons";
import { Check, X } from "lucide-react";
import { MakeResolution, formatMakeOptions } from "@/lib/vehicle/makeResolver";
import { NegotiationConfidenceMeter } from "@/components/NegotiationConfidenceMeter";
import { ConfidenceResult } from "@/hooks/useNegotiationConfidence";

interface ConversationCanvasProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onClearMessages: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFirstMessageAnimated?: () => void;
  isLoading: boolean;
  isExtracting: boolean;
  scoreResult?: { overall: number } | null;
  onViewAnalysis?: () => void;
  // Dealership mode props
  isDealershipMode?: boolean;
  onDealershipModeChange?: (enabled: boolean) => void;
  showDealershipCheck?: boolean;
  onDealershipCheckResponse?: (isAtDealership: boolean) => void;
  // Deal context for quick replies
  dealContext?: DealContext;
  targets?: { targetOTD?: string; targetTermMonths?: string };
  // Navigation callbacks for action buttons
  onGoToWhatToSay?: () => void;
  onCompareAnother?: () => void;
  // Make suggestion confirmation (enhanced with multi-option support)
  pendingMakeSuggestion?: MakeResolution | null;
  // Mobile header: progress meter integration
  negotiationConfidence?: ConfidenceResult;
  isLoggedIn?: boolean | null;
  isSaving?: boolean;
  lastSavedAt?: Date | null;
}

export function ConversationCanvas({
  messages,
  onSendMessage,
  onClearMessages,
  onFileUpload,
  onFirstMessageAnimated,
  isLoading,
  isExtracting,
  scoreResult,
  onViewAnalysis,
  isDealershipMode = false,
  onDealershipModeChange,
  showDealershipCheck = false,
  onDealershipCheckResponse,
  dealContext,
  targets,
  onGoToWhatToSay,
  onCompareAnother,
  pendingMakeSuggestion,
  negotiationConfidence,
  isLoggedIn: externalIsLoggedIn,
  isSaving = false,
  lastSavedAt = null,
}: ConversationCanvasProps) {
  const [input, setInput] = useState("");
  const [hasAnimatedWelcome, setHasAnimatedWelcome] = useState(false);
  const lastWelcomeContentRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  
  // Use external login state if provided, otherwise check ourselves
  const [internalIsLoggedIn, setInternalIsLoggedIn] = useState<boolean | null>(null);
  const isLoggedIn = externalIsLoggedIn ?? internalIsLoggedIn;

  // Check auth state only if not provided externally
  useEffect(() => {
    if (externalIsLoggedIn !== undefined) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setInternalIsLoggedIn(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setInternalIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [externalIsLoggedIn]);

  // Auto-scroll chat container only (not the page)
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Check if there are any user messages (conversation has started)
  const hasUserMessages = messages.some(m => m.role === "user");
  
  // Track welcome message content to detect when a new welcome arrives
  const currentWelcomeContent = messages.length === 1 && messages[0].role === "assistant" 
    ? messages[0].content 
    : null;
  
  // Determine if we should animate the welcome message
  // Animate when: we have a welcome message AND we haven't animated THIS specific welcome yet
  const shouldAnimateWelcome = currentWelcomeContent !== null && 
    !hasAnimatedWelcome &&
    currentWelcomeContent !== lastWelcomeContentRef.current;
    
  const handleWelcomeAnimationComplete = () => {
    setHasAnimatedWelcome(true);
    lastWelcomeContentRef.current = currentWelcomeContent;
    onFirstMessageAnimated?.();
  };
  
  // Reset animation flag when a new welcome message appears (different content)
  useEffect(() => {
    if (currentWelcomeContent !== null && currentWelcomeContent !== lastWelcomeContentRef.current) {
      // New welcome message detected, allow animation
      setHasAnimatedWelcome(false);
    }
  }, [currentWelcomeContent]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-card md:rounded-2xl md:border md:border-border md:shadow-card overflow-hidden">
      {/* Header - Mobile uses progress meter as header, desktop shows full header */}
      {isMobile ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0 border-b border-border bg-background">
          {/* Progress meter as the main header element */}
          {negotiationConfidence ? (
            <NegotiationConfidenceMeter 
              confidence={negotiationConfidence}
              className="flex-1"
              isLoggedIn={isLoggedIn ?? false}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-3.5 w-3.5" />
              </div>
              {isDealershipMode && (
                <span className="text-xs font-medium text-warning flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Dealership
                </span>
              )}
            </div>
          )}
          
          {/* Kebab menu with all actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {hasUserMessages && (
                <DropdownMenuItem onClick={onClearMessages}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  New chat
                </DropdownMenuItem>
              )}
              {onDealershipModeChange && (
                <DropdownMenuItem onClick={() => onDealershipModeChange(!isDealershipMode)}>
                  <Zap className="h-4 w-4 mr-2" />
                  {isDealershipMode ? "Disable" : "Enable"} Dealership Mode
                </DropdownMenuItem>
              )}
              {(hasUserMessages || onDealershipModeChange) && <DropdownMenuSeparator />}
              {isLoggedIn === false && (
                <DropdownMenuItem asChild>
                  <Link to="/auth">
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in to save
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/contact">
                  <Mail className="h-4 w-4 mr-2" />
                  Contact / Report issue
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <span className="font-medium text-foreground">Deal Room</span>
          </div>
          <div className="flex items-center gap-2">
            {onDealershipModeChange && (
              <DealershipModeToggle
                isEnabled={isDealershipMode}
                onToggle={onDealershipModeChange}
              />
            )}
            {hasUserMessages && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearMessages}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Start new chat"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Messages Area - iOS touch scrolling enabled */}
      <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isLastAssistantMessage = 
              message.role === "assistant" && 
              index === messages.length - 1 &&
              !isLoading;
            
            // Count user messages for the fallback logic
            const userMessageCount = messages.filter(m => m.role === "user").length;
            
            const showActionButtons = 
              isLastAssistantMessage && 
              shouldShowActionButtons(message.content, userMessageCount) &&
              onGoToWhatToSay && 
              onCompareAnother;

            return (
              <div key={index}>
                <MessageBubble 
                  message={message} 
                  shouldAnimate={index === 0 && shouldAnimateWelcome}
                  onAnimationComplete={handleWelcomeAnimationComplete}
                />
                {showActionButtons && (
                  <ChatActionButtons
                    onGoToWhatToSay={onGoToWhatToSay}
                  />
                )}
              </div>
            );
          })}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Extracting indicator */}
          {isExtracting && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Reading your document...</span>
                </div>
              </div>
            </div>
          )}

          {/* Score result notification */}
          {scoreResult && !isLoading && (
            <div className="flex justify-center py-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onViewAnalysis}
                className="text-primary border-primary/30 hover:bg-primary/10"
              >
                DuoDrive Score: {scoreResult.overall} — View Full Analysis
              </Button>
            </div>
          )}

          {/* Dealership check quick replies (initial check) */}
          {showDealershipCheck && onDealershipCheckResponse && !isLoading && (
            <DealershipCheck
              onSelect={onDealershipCheckResponse}
              disabled={isLoading}
            />
          )}

          {/* Dealership Mode Quick Replies (tactical scripts) */}
          {isDealershipMode && !showDealershipCheck && dealContext && (
            <div className="pt-2">
              <DealershipQuickReplies
                dealContext={dealContext}
                isDealershipMode={isDealershipMode}
                onSendMessage={onSendMessage}
                targets={targets}
              />
            </div>
          )}

           {/* Yes/No quick replies for make suggestion confirmation */}
           {pendingMakeSuggestion && !isLoading && (
             <div className="flex gap-2 ml-11 mt-2">
               {/* Single suggestion: Yes/No buttons */}
               {pendingMakeSuggestion.type === "suggest_one" && (
                 <>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => onSendMessage("Yes")}
                     className="h-8 gap-1.5 border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                   >
                     <Check className="h-3.5 w-3.5" />
                     Yes, {pendingMakeSuggestion.suggestion}
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => onSendMessage("No")}
                     className="h-8 gap-1.5"
                   >
                     <X className="h-3.5 w-3.5" />
                     No
                   </Button>
                 </>
               )}
               {/* Multiple suggestions: Show each as a button */}
               {pendingMakeSuggestion.type === "suggest_many" && (
                 <>
                   {pendingMakeSuggestion.options.map((opt) => (
                     <Button
                       key={opt.make}
                       variant="outline"
                       size="sm"
                       onClick={() => onSendMessage(opt.make)}
                       className="h-8 gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
                     >
                       {opt.make}
                     </Button>
                   ))}
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => onSendMessage("Neither")}
                     className="h-8 gap-1.5"
                   >
                     Neither
                   </Button>
                 </>
               )}
             </div>
           )}
 
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border bg-background space-y-3 p-4">
        <div className="flex items-center gap-2">
          {/* Upload Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                disabled={isLoading || isExtracting}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" />
                Choose Photo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => pdfInputRef.current?.click()}>
                <FileText className="h-4 w-4 mr-2" />
                Upload PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileUpload}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            className="hidden"
          />
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={onFileUpload}
            className="hidden"
          />

          {/* Voice Input (mobile) */}
          {isMobile && (
            <VoiceInputButton
              onTranscript={onSendMessage}
              disabled={isLoading || isExtracting}
              atDealership={isDealershipMode}
            />
          )}

          {/* Text Input */}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            className="flex-1 h-10"
            disabled={isLoading || isExtracting}
          />

          {/* Send Button */}
          <Button 
            onClick={handleSend} 
            size="icon" 
            className="h-10 w-10 shrink-0"
            disabled={!input.trim() || isLoading || isExtracting}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Helper tips - hide on mobile after first message */}
        <ChatHelperTips isDealershipMode={isDealershipMode} hasUserMessages={hasUserMessages} />

        {/* Sign in to save prompt */}
        {isLoggedIn === false && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LogIn className="h-3.5 w-3.5" />
            <span>
              <Link to="/auth" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
              {" "}to save and compare deals
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ 
  message, 
  shouldAnimate = false,
  onAnimationComplete
}: { 
  message: ChatMessage;
  shouldAnimate?: boolean;
  onAnimationComplete?: () => void;
}) {
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
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
          {shouldAnimate && !isUser ? (
            <p className="mb-0">
              <TypewriterText 
                text={message.content} 
                speed={80}
                onComplete={onAnimationComplete}
              />
            </p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
