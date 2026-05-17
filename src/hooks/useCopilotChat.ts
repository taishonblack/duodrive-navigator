import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

// Versioned keys to clear legacy seeded messages
const CHAT_STORAGE_KEY = "duodrive_copilot_chat_v3";
const CHAT_TIMESTAMP_KEY = "duodrive_copilot_chat_timestamp_v3";
const RESUME_CONVERSATION_KEY = "duodrive_resume_conversation_v3";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isNew?: boolean; // Flag for newly created messages that should animate
}

// 20+ casual opening greetings - Quinn picks one randomly
const QUINN_GREETINGS = [
  "Hey — I'm Quinn. I'm here to help you think through this car deal and make sure it actually makes sense.",
  "I'm Quinn. What car are you looking at?",
  "Hey, I'm Quinn. I help people slow car deals down and make smarter decisions. What are you looking at today?",
  "What can I help you with today?",
  "What kind of car are you looking at?",
  "Tell me what you're shopping for.",
  "What car are you considering right now?",
  "How can I help with your car search?",
  "What vehicle are you looking into?",
  "What are you hoping to find today?",
  "What's the car you're thinking about?",
  "What are you trying to decide on?",
  "What deal do you want help evaluating?",
  "What car do you want to take a closer look at?",
  "What are you currently shopping for?",
  "What vehicle do you have questions about?",
  "What's on your shortlist right now?",
  "What car are you looking at today?",
  "What do you want to run by me?",
  "What are you considering buying?",
  "What kind of car are you in the market for?",
];

// Get a random greeting - uses session storage to persist during session
const GREETING_STORAGE_KEY = "duodrive_quinn_greeting_v3";

const getRandomGreeting = (): string => {
  try {
    const stored = sessionStorage.getItem(GREETING_STORAGE_KEY);
    if (stored) return stored;
    
    const randomIndex = Math.floor(Math.random() * QUINN_GREETINGS.length);
    const greeting = QUINN_GREETINGS[randomIndex];
    sessionStorage.setItem(GREETING_STORAGE_KEY, greeting);
    return greeting;
  } catch {
    return QUINN_GREETINGS[0];
  }
};

// Clear stored greeting to get a fresh one
const clearStoredGreeting = () => {
  try {
    sessionStorage.removeItem(GREETING_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
};

// Quinn's opening message - casual, human, no immediate name demand
const getWelcomeMessage = (isNew: boolean = false): ChatMessage => ({
  role: "assistant",
  content: getRandomGreeting(),
  isNew, // Mark as new for typewriter animation
});

// Sanitize legacy "Henry" messages when loading from DB
const sanitizeLegacyMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map((msg) => {
    if (msg.role === "assistant" && msg.content.includes("Henry")) {
      // If first message contains "I'm Henry" greeting, replace with fresh Quinn greeting
      if (msg.content.match(/I'm Henry|I am Henry|name is Henry/i)) {
        return { ...msg, content: getRandomGreeting() };
      }
      // Otherwise just replace Henry → Quinn throughout
      return { ...msg, content: msg.content.replace(/Henry/g, "Quinn") };
    }
    return msg;
  });
};

// Check if chat has expired (24 hours)
const isChatExpired = (): boolean => {
  try {
    const timestamp = localStorage.getItem(CHAT_TIMESTAMP_KEY);
    if (!timestamp) return true;
    const storedTime = parseInt(timestamp, 10);
    return Date.now() - storedTime > TWENTY_FOUR_HOURS_MS;
  } catch {
    return true;
  }
};

// Get stored messages or initialize with welcome message
const getStoredMessages = (): ChatMessage[] => {
  try {
    // Check expiration first
    if (isChatExpired()) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CHAT_TIMESTAMP_KEY);
      return [getWelcomeMessage(true)]; // New session = animate
    }
    
    const stored = localStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Loaded from storage = don't animate
        return parsed.map((msg: ChatMessage) => ({ ...msg, isNew: false }));
      }
    }
  } catch (e) {
    console.error("Failed to load chat messages:", e);
  }
  return [getWelcomeMessage(true)]; // Fresh start = animate
};

// Save messages to localStorage with timestamp
const saveMessagesToLocal = (messages: ChatMessage[]) => {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    // Only set timestamp if not already set (first message in session)
    if (!localStorage.getItem(CHAT_TIMESTAMP_KEY)) {
      localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
    }
  } catch (e) {
    console.error("Failed to save chat messages:", e);
  }
};

export function useCopilotChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load or create conversation for authenticated users
  useEffect(() => {
    if (!user) {
      setConversationId(null);
      return;
    }

    const loadOrCreateConversation = async () => {
      try {
        // Check if we're resuming a specific conversation
        const resumeData = localStorage.getItem(RESUME_CONVERSATION_KEY);
        if (resumeData) {
          try {
            const parsed = JSON.parse(resumeData);
            if (parsed.id && parsed.messages) {
              setConversationId(parsed.id);
              // Sanitize legacy messages before setting
              setMessages(sanitizeLegacyMessages(parsed.messages));
              // Clear the resume flag
              localStorage.removeItem(RESUME_CONVERSATION_KEY);
              return;
            }
          } catch {
            localStorage.removeItem(RESUME_CONVERSATION_KEY);
          }
        }

        // Check for existing active conversation (updated within last 24 hours)
        const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();
        const { data: existing } = await supabase
          .from("chat_conversations")
          .select("id, messages")
          .eq("user_id", user.id)
          .gte("updated_at", cutoff)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          setConversationId(existing.id);
          // Load messages from database and sanitize legacy "Henry" references
          const dbMessages = existing.messages as unknown as ChatMessage[];
          if (dbMessages && Array.isArray(dbMessages) && dbMessages.length > 0) {
            const sanitized = sanitizeLegacyMessages(dbMessages);
            setMessages(sanitized);
            
            // If messages were sanitized (changed), update DB to persist the fix
            const wasChanged = JSON.stringify(sanitized) !== JSON.stringify(dbMessages);
            if (wasChanged) {
              supabase
                .from("chat_conversations")
                .update({ messages: JSON.parse(JSON.stringify(sanitized)) })
                .eq("id", existing.id)
                .then(() => console.log("Legacy messages sanitized and saved"));
            }
          }
        } else {
          // Create new conversation
          const { data: newConv, error } = await supabase
            .from("chat_conversations")
            .insert([{
              user_id: user.id,
              messages: JSON.parse(JSON.stringify(messages)),
            }])
            .select("id")
            .single();

          if (error) {
            console.error("Failed to create conversation:", error);
          } else {
            setConversationId(newConv.id);
          }
        }
      } catch (e) {
        console.error("Failed to load/create conversation:", e);
      }
    };

    loadOrCreateConversation();
  }, [user]);

  // Persist messages - debounced for DB, immediate for localStorage
  useEffect(() => {
    // Always save to localStorage for immediate access
    saveMessagesToLocal(messages);

    // For authenticated users, also save to database (debounced)
    if (user && conversationId) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from("chat_conversations")
            .update({ messages: JSON.parse(JSON.stringify(messages)) })
            .eq("id", conversationId);
        } catch (e) {
          console.error("Failed to save to database:", e);
        }
      }, 1000); // Debounce 1 second
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, user, conversationId]);

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

  const clearMessages = useCallback(async () => {
    // Clear stored greeting to get a fresh one
    clearStoredGreeting();
    const welcome = getWelcomeMessage(true); // New message = animate
    setMessages([welcome]);
    
    // Reset timestamp for new 24-hour window
    localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
    
    // For authenticated users, create a new conversation
    if (user) {
      try {
        const { data: newConv, error } = await supabase
          .from("chat_conversations")
          .insert([{
            user_id: user.id,
            messages: JSON.parse(JSON.stringify([welcome])),
          }])
          .select("id")
          .single();

        if (!error && newConv) {
          setConversationId(newConv.id);
        }
      } catch (e) {
        console.error("Failed to create new conversation:", e);
      }
    }
  }, [user]);

  const refreshWelcome = useCallback(() => {
    // Only refresh if there's just the welcome message
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        clearStoredGreeting();
        return [getWelcomeMessage(true)]; // New message = animate
      }
      return prev;
    });
  }, []);

  // Mark first message as animated after it's been shown
  const markFirstMessageAnimated = useCallback(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].isNew) {
        const updated = [...prev];
        updated[0] = { ...updated[0], isNew: false };
        return updated;
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
    markFirstMessageAnimated,
    isLoading,
    setIsLoading,
  };
}
