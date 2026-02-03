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

// 20 casual opening greetings - Henry picks one randomly
const HENRY_GREETINGS = [
  "Hey — glad you stopped by. I'm Henry.",
  "Hey there. I'm Henry. What are you looking at today?",
  "Hi — I'm Henry. Want to walk through a car deal together?",
  "Hey. I can help you sanity-check a car if you want.",
  "Hi there. I'm Henry. No pressure — just clarity.",
  "Hey — car shopping can be a lot. I'm Henry.",
  "Hi. I'm Henry. We'll take this one step at a time.",
  "Hey — before you sign anything, let's look at it together.",
  "Hi there. I'm Henry. Happy to help however you want to use this.",
  "Hey. I'm Henry. What's on the table today?",
  "Hi — how can I help you?",
  "Hey there. I'm Henry. We'll keep this simple.",
  "Hi. I help people figure out if a car actually makes sense.",
  "Hey — no sales pitch here. I'm Henry.",
  "Hi there. Want to break down a car deal without the jargon?",
  "Hey. I'm Henry. Nothing here locks you into anything.",
  "Hi — I'm Henry. What kind of car are you considering?",
  "Hey there. I can help you slow this down and look at the numbers.",
  "Hi. I'm Henry. You're in the right place if you want clarity.",
  "Hey — I'm Henry. Let's take a look together.",
];

// Get a random greeting - uses session storage to persist during session
const getRandomGreeting = (): string => {
  const storageKey = "duodrive_henry_greeting";
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) return stored;
    
    const randomIndex = Math.floor(Math.random() * HENRY_GREETINGS.length);
    const greeting = HENRY_GREETINGS[randomIndex];
    sessionStorage.setItem(storageKey, greeting);
    return greeting;
  } catch {
    return HENRY_GREETINGS[0];
  }
};

// Henry's opening message - casual, human, no immediate name demand
const getWelcomeMessage = (): ChatMessage => ({
  role: "assistant",
  content: getRandomGreeting(),
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
