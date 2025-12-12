import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PresenceState {
  onlineUserIds: string[];
  typingUserIds: string[];
  isPartnerOnline: boolean;
  isPartnerTyping: boolean;
}

export function useChatPresence(
  channelName: string,
  userId: string,
  partnerId: string
) {
  const [presence, setPresence] = useState<PresenceState>({
    onlineUserIds: [],
    typingUserIds: [],
    isPartnerOnline: false,
    isPartnerTyping: false,
  });
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!channelName || !userId) return;

    const channel = supabase.channel(`presence-${channelName}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const onlineUsers = Object.keys(state);
        const typingUsers = Object.values(state)
          .flat()
          .filter((p: any) => p.isTyping)
          .map((p: any) => p.user_id);

        setPresence({
          onlineUserIds: onlineUsers,
          typingUserIds: typingUsers,
          isPartnerOnline: onlineUsers.includes(partnerId),
          isPartnerTyping: typingUsers.includes(partnerId),
        });
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("User joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("User left:", key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
            isTyping: false,
          });
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [channelName, userId, partnerId]);

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!channelRef.current) return;

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      await channelRef.current.track({
        user_id: userId,
        online_at: new Date().toISOString(),
        isTyping,
      });

      // Auto-stop typing after 3 seconds
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(async () => {
          if (channelRef.current) {
            await channelRef.current.track({
              user_id: userId,
              online_at: new Date().toISOString(),
              isTyping: false,
            });
          }
        }, 3000);
      }
    },
    [userId]
  );

  return {
    ...presence,
    setTyping,
  };
}