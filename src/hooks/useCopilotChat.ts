import { useState, useEffect, useCallback } from "react";

const CHAT_STORAGE_KEY = "duodrive_copilot_chat";

export interface ChatMessage {
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

const getWelcomeMessage = (): ChatMessage => ({
  role: "assistant",
  content: `${getGreeting()}! 👋 I'm your DuoDrive AI Copilot — here to help you understand and evaluate your car deal.

**How to get started:**
Type or paste your deal information below. It can be messy — a dealer quote, a screenshot text, bullet points, or even just a few details. I'll extract what I can and help fill in the gaps.

**Example:**
"2021 Honda Accord LX, 35k miles, asking $24,500. They want $3k down, 6.9% APR for 60 months. Doc fee $399. I make about $5,000/month."

Once I have your deal info, I'll calculate your DuoDrive Score and show you if it's a fair price, what to negotiate, and how it fits your budget.

Ready when you are! 🚗`,
});

// Get stored messages or initialize with welcome message
const getStoredMessages = (): ChatMessage[] => {
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load chat messages:", e);
  }
  return [getWelcomeMessage()];
};

// Save messages to localStorage
const saveMessages = (messages: ChatMessage[]) => {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save chat messages:", e);
  }
};

export function useCopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredMessages());
  const [isLoading, setIsLoading] = useState(false);

  // Persist messages whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateLastMessage = useCallback((content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      return updated;
    });
  }, []);

  const clearMessages = useCallback(() => {
    const welcome = getWelcomeMessage();
    setMessages([welcome]);
  }, []);

  const refreshWelcome = useCallback(() => {
    // Only refresh if there's just the welcome message
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [getWelcomeMessage()];
      }
      return prev;
    });
  }, []);

  return {
    messages,
    setMessages,
    addMessage,
    updateLastMessage,
    clearMessages,
    refreshWelcome,
    isLoading,
    setIsLoading,
  };
}
