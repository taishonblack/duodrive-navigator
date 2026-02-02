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
}

// Henry's opening message - he owns the greeting
const getWelcomeMessage = (): ChatMessage => ({
  role: "assistant",
  content: `Hi — I'm Henry, the DuoDrive AI Copilot. I'm here to help you think through your car purchase and find the best possible deal.

Before we dive in, I need to ask one quick thing so I don't make this awkward later 🙂

What's your name?`,
});

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
      return [getWelcomeMessage()];
    }
    
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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
              setMessages(parsed.messages);
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
          // Load messages from database
          const dbMessages = existing.messages as unknown as ChatMessage[];
          if (dbMessages && Array.isArray(dbMessages) && dbMessages.length > 0) {
            setMessages(dbMessages);
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
    const welcome = getWelcomeMessage();
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
