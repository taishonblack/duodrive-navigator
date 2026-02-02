import { useEffect, useRef, useCallback, useMemo } from "react";
import { ChatMessage } from "@/hooks/useCopilotChat";

// Message types for BroadcastChannel communication
export type HenryBroadcastMessage =
  | { type: "INIT_REQUEST" }
  | { type: "INIT_RESPONSE"; payload: { messages: ChatMessage[]; dealContext: Record<string, string> } }
  | { type: "POPOUT_USER_MESSAGE"; payload: { tempId: string; content: string } }
  | { type: "MAIN_MESSAGES_UPDATE"; payload: { messages: ChatMessage[] } }
  | { type: "MAIN_DEALCONTEXT_UPDATE"; payload: { dealContext: Record<string, string> } }
  | { type: "POPOUT_FOCUS_MAIN" }
  | { type: "POPOUT_CLOSED" }
  | { type: "MAIN_LOADING_STATE"; payload: { isLoading: boolean } };

const CHANNEL_NAME = "duodrive_henry";

interface UseHenryBroadcastMainOptions {
  messages: ChatMessage[];
  dealContext: Record<string, string>;
  isLoading: boolean;
  onPopoutMessage: (content: string, tempId: string) => void;
}

/**
 * Hook for the MAIN Deal Room tab - acts as the source of truth
 */
export function useHenryBroadcastMain({
  messages,
  dealContext,
  isLoading,
  onPopoutMessage,
}: UseHenryBroadcastMainOptions) {
  const channel = useMemo(() => {
    try {
      return new BroadcastChannel(CHANNEL_NAME);
    } catch {
      console.warn("BroadcastChannel not supported");
      return null;
    }
  }, []);

  // Handle incoming messages from popout
  useEffect(() => {
    if (!channel) return;

    const handleMessage = (event: MessageEvent<HenryBroadcastMessage>) => {
      const { type } = event.data || {};
      if (!type) return;

      switch (type) {
        case "INIT_REQUEST":
          // Popout is requesting initial state
          channel.postMessage({
            type: "INIT_RESPONSE",
            payload: { messages, dealContext },
          } as HenryBroadcastMessage);
          break;

        case "POPOUT_USER_MESSAGE":
          // User typed in popout - forward to main for processing
          const { content, tempId } = (event.data as Extract<HenryBroadcastMessage, { type: "POPOUT_USER_MESSAGE" }>).payload;
          onPopoutMessage(content, tempId);
          break;

        case "POPOUT_FOCUS_MAIN":
          window.focus();
          break;

        case "POPOUT_CLOSED":
          // Popout was closed - could update UI state if needed
          break;
      }
    };

    channel.onmessage = handleMessage;

    return () => {
      channel.onmessage = null;
    };
  }, [channel, messages, dealContext, onPopoutMessage]);

  // Broadcast messages updates to popout
  useEffect(() => {
    if (!channel) return;
    channel.postMessage({
      type: "MAIN_MESSAGES_UPDATE",
      payload: { messages },
    } as HenryBroadcastMessage);
  }, [channel, messages]);

  // Broadcast deal context updates to popout
  useEffect(() => {
    if (!channel) return;
    channel.postMessage({
      type: "MAIN_DEALCONTEXT_UPDATE",
      payload: { dealContext },
    } as HenryBroadcastMessage);
  }, [channel, dealContext]);

  // Broadcast loading state to popout
  useEffect(() => {
    if (!channel) return;
    channel.postMessage({
      type: "MAIN_LOADING_STATE",
      payload: { isLoading },
    } as HenryBroadcastMessage);
  }, [channel, isLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      channel?.close();
    };
  }, [channel]);

  return { channel };
}

interface UseHenryBroadcastPopoutOptions {
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  onDealContextUpdate: (dealContext: Record<string, string>) => void;
  onLoadingStateUpdate: (isLoading: boolean) => void;
}

/**
 * Hook for the POPOUT window - receives updates and forwards user input
 */
export function useHenryBroadcastPopout({
  onMessagesUpdate,
  onDealContextUpdate,
  onLoadingStateUpdate,
}: UseHenryBroadcastPopoutOptions) {
  const channel = useMemo(() => {
    try {
      return new BroadcastChannel(CHANNEL_NAME);
    } catch {
      console.warn("BroadcastChannel not supported");
      return null;
    }
  }, []);

  const initReceived = useRef(false);

  // Request initial state on mount
  useEffect(() => {
    if (!channel) return;

    const handleMessage = (event: MessageEvent<HenryBroadcastMessage>) => {
      const { type } = event.data || {};
      if (!type) return;

      switch (type) {
        case "INIT_RESPONSE":
          if (!initReceived.current) {
            initReceived.current = true;
            const { messages, dealContext } = (event.data as Extract<HenryBroadcastMessage, { type: "INIT_RESPONSE" }>).payload;
            onMessagesUpdate(messages);
            onDealContextUpdate(dealContext);
          }
          break;

        case "MAIN_MESSAGES_UPDATE":
          const { messages } = (event.data as Extract<HenryBroadcastMessage, { type: "MAIN_MESSAGES_UPDATE" }>).payload;
          onMessagesUpdate(messages);
          break;

        case "MAIN_DEALCONTEXT_UPDATE":
          const { dealContext } = (event.data as Extract<HenryBroadcastMessage, { type: "MAIN_DEALCONTEXT_UPDATE" }>).payload;
          onDealContextUpdate(dealContext);
          break;

        case "MAIN_LOADING_STATE":
          const { isLoading } = (event.data as Extract<HenryBroadcastMessage, { type: "MAIN_LOADING_STATE" }>).payload;
          onLoadingStateUpdate(isLoading);
          break;
      }
    };

    channel.onmessage = handleMessage;

    // Request initial state
    channel.postMessage({ type: "INIT_REQUEST" } as HenryBroadcastMessage);

    return () => {
      channel.onmessage = null;
    };
  }, [channel, onMessagesUpdate, onDealContextUpdate, onLoadingStateUpdate]);

  // Send user message to main tab
  const sendMessage = useCallback((content: string) => {
    if (!channel) return;
    const tempId = crypto.randomUUID();
    channel.postMessage({
      type: "POPOUT_USER_MESSAGE",
      payload: { tempId, content },
    } as HenryBroadcastMessage);
    return tempId;
  }, [channel]);

  // Focus the main tab
  const focusMain = useCallback(() => {
    if (!channel) return;
    channel.postMessage({ type: "POPOUT_FOCUS_MAIN" } as HenryBroadcastMessage);
  }, [channel]);

  // Notify main that popout is closing
  const notifyClose = useCallback(() => {
    if (!channel) return;
    channel.postMessage({ type: "POPOUT_CLOSED" } as HenryBroadcastMessage);
  }, [channel]);

  // Cleanup
  useEffect(() => {
    return () => {
      channel?.close();
    };
  }, [channel]);

  return {
    sendMessage,
    focusMain,
    notifyClose,
    isConnected: !!channel,
  };
}

/**
 * Open the Henry popout window
 * Returns false if popup was blocked
 */
export function openHenryPopout(): Window | null {
  const existingPopout = window.open("", "duodrive_henry");
  
  // If we got an existing window with content, just focus it
  if (existingPopout && existingPopout.location.href !== "about:blank") {
    existingPopout.focus();
    return existingPopout;
  }

  // Open new popout window
  const popout = window.open(
    "/henry/popout",
    "duodrive_henry",
    "width=420,height=680,resizable=yes,scrollbars=yes"
  );

  if (popout) {
    popout.focus();
  }

  return popout;
}
