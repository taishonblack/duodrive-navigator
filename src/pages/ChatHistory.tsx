import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Clock, Loader2, LogIn, 
  Calendar, ChevronRight, RefreshCw, Bot, Pin
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ChatConversation {
  id: string;
  title: string | null;
  messages: any;
  is_pinned: boolean | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);
      await fetchConversations(currentUser.id);
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  const getMessageCount = (messages: any): number => {
    if (Array.isArray(messages)) return messages.length;
    return 0;
  };

  const getFirstMessage = (messages: any): string => {
    if (Array.isArray(messages) && messages.length > 0) {
      const firstUserMessage = messages.find((m: any) => m.role === "user");
      if (firstUserMessage) {
        return firstUserMessage.content?.slice(0, 100) + (firstUserMessage.content?.length > 100 ? "..." : "");
      }
    }
    return "No messages";
  };

  if (isLoading) {
    return (
      <Layout>
        <SEO 
          title="Chat History"
          description="View your conversation history with Quinn, your AI car buying assistant."
          canonical="/chat-history"
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <SEO 
          title="Chat History"
          description="View your conversation history with Quinn, your AI car buying assistant."
          canonical="/chat-history"
        />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <LogIn className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>Sign In Required</CardTitle>
              <CardDescription>
                Please sign in to view your chat history.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/auth")}>
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO 
        title="Chat History"
        description="View your conversation history with Quinn, your AI car buying assistant."
        canonical="/chat-history"
      />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chat History</h1>
            <p className="text-muted-foreground">Your conversations with Quinn</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => user && fetchConversations(user.id)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {conversations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No conversations yet</h3>
              <p className="text-muted-foreground mb-4">
                Start chatting with Quinn in the Deal Room to see your history here.
              </p>
              <Button onClick={() => navigate("/deal-room")}>
                Go to Deal Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Card 
                key={conversation.id}
                className="hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/deal-room?conversationId=${conversation.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground truncate">
                          {conversation.title || "Untitled Conversation"}
                        </h3>
                        {conversation.is_pinned && (
                          <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {getFirstMessage(conversation.messages)}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {getMessageCount(conversation.messages)} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(conversation.updated_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      {conversation.tags && conversation.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {conversation.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
