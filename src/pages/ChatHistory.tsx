import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  MessageSquare, Clock, Loader2, LogIn, 
  Calendar, ChevronRight, Star, RefreshCw, Phone, Video
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addMinutes } from "date-fns";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";

interface ChatSession {
  id: string;
  status: string;
  scheduled_duration_minutes: number;
  actual_duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  coach_id: string;
  coach_name?: string;
  coach_photo_url?: string;
  coach_bio?: string;
  rating?: number;
  feedback?: string;
}

interface CoachingSession {
  id: string;
  session_type: "text" | "phone" | "video";
  status: string;
  scheduled_duration_minutes: number;
  actual_duration_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  coach_id: string;
  meet_link: string | null;
  coach_name?: string;
  coach_photo_url?: string;
  coach_bio?: string;
}

interface ChatMessage {
  id: string;
  sender_type: "coach" | "customer";
  content: string;
  created_at: string;
}

const sessionTypeIcons = {
  text: MessageSquare,
  phone: Phone,
  video: Video,
};

export default function ChatHistory() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [coachingSessions, setCoachingSessions] = useState<CoachingSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

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
      await Promise.all([
        fetchChatHistory(currentUser.id),
        fetchCoachingSessions(currentUser.id),
      ]);
    } catch (error) {
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChatHistory = async (userId: string) => {
    try {
      // Fetch all chat sessions
      const { data: sessions, error } = await supabase
        .from("coach_chat_sessions")
        .select(`
          id,
          status,
          scheduled_duration_minutes,
          actual_duration_minutes,
          started_at,
          ended_at,
          created_at,
          coach_id
        `)
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        // Fetch coach details
        const coachIds = [...new Set(sessions.map(s => s.coach_id))];
        const { data: coaches } = await supabase
          .from("coaches")
          .select("id, display_name, photo_url, bio")
          .in("id", coachIds);

        // Fetch ratings for completed sessions
        const { data: ratings } = await supabase
          .from("session_ratings")
          .select("chat_session_id, rating, feedback")
          .in("chat_session_id", sessions.map(s => s.id));

        const coachMap: Record<string, any> = {};
        coaches?.forEach(c => {
          coachMap[c.id] = c;
        });

        const ratingMap: Record<string, { rating: number; feedback: string | null }> = {};
        ratings?.forEach(r => {
          ratingMap[r.chat_session_id] = { rating: r.rating, feedback: r.feedback };
        });

        setChatSessions(sessions.map(s => ({
          ...s,
          coach_name: coachMap[s.coach_id]?.display_name,
          coach_photo_url: coachMap[s.coach_id]?.photo_url,
          coach_bio: coachMap[s.coach_id]?.bio,
          rating: ratingMap[s.id]?.rating,
          feedback: ratingMap[s.id]?.feedback || undefined,
        })));
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  const fetchCoachingSessions = async (userId: string) => {
    try {
      const { data: sessions, error } = await supabase
        .from("coaching_sessions")
        .select(`
          id,
          session_type,
          status,
          scheduled_duration_minutes,
          actual_duration_minutes,
          started_at,
          ended_at,
          created_at,
          coach_id,
          meet_link
        `)
        .eq("customer_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        const coachIds = [...new Set(sessions.map(s => s.coach_id))];
        const { data: coaches } = await supabase
          .from("coaches")
          .select("id, display_name, photo_url, bio")
          .in("id", coachIds);

        const coachMap: Record<string, any> = {};
        coaches?.forEach(c => {
          coachMap[c.id] = c;
        });

        setCoachingSessions(sessions.map(s => ({
          ...s,
          session_type: s.session_type as "text" | "phone" | "video",
          coach_name: coachMap[s.coach_id]?.display_name,
          coach_photo_url: coachMap[s.coach_id]?.photo_url,
          coach_bio: coachMap[s.coach_id]?.bio,
        })));
      }
    } catch (error) {
      console.error("Error fetching coaching sessions:", error);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    if (messages[sessionId]) return;

    setLoadingMessages(sessionId);
    try {
      const { data, error } = await supabase
        .from("coach_chat_messages")
        .select("id, sender_type, content, created_at")
        .eq("chat_session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(prev => ({
        ...prev,
        [sessionId]: (data || []) as ChatMessage[],
      }));
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(null);
    }
  };

  const handleAccordionChange = (value: string) => {
    setExpandedSession(value || null);
    if (value) {
      fetchMessages(value);
    }
  };

  const handleRebook = (coachId: string, sessionType: "text" | "phone" | "video" = "text") => {
    // Store coach preference and redirect to coaching page
    sessionStorage.setItem("preferredCoachId", coachId);
    const tierMap: Record<string, string> = {
      text: "Quick Text Help",
      phone: "Live Phone Session",
      video: "Full Concierge",
    };
    sessionStorage.setItem("selectedCoachingTier", tierMap[sessionType]);
    navigate("/coaching#book-session");
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500/10 text-green-600 border-green-500/20",
      active: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      ready: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
      pending: "bg-muted text-muted-foreground",
    };
    return colors[status] || colors.pending;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <SEO 
          title="Coaching History - Login Required"
          description="View your coaching session history."
          noIndex
        />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Login Required</h2>
              <p className="text-muted-foreground mb-6">
                Please log in to view your coaching history.
              </p>
              <Button onClick={() => navigate("/auth")} className="w-full">
                Log In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const allSessions = [
    ...chatSessions.map(s => ({ ...s, sessionCategory: "chat" as const })),
    ...coachingSessions.map(s => ({ ...s, sessionCategory: "coaching" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Layout>
      <SEO 
        title="Coaching History"
        description="View transcripts and details of your past coaching sessions."
        noIndex
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Coaching History</h1>
          <p className="text-muted-foreground">
            View past sessions, transcripts, and ratings
          </p>
        </div>

        {allSessions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Sessions Yet</h3>
              <p className="text-muted-foreground mb-6">
                When you complete a coaching session, it will appear here.
              </p>
              <Button onClick={() => navigate("/coaching")}>
                Book a Coaching Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Text Chat Sessions with Transcripts */}
            {chatSessions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Text Chat Sessions
                </h2>
                <Accordion
                  type="single"
                  collapsible
                  value={expandedSession || undefined}
                  onValueChange={handleAccordionChange}
                >
                  {chatSessions.map((session) => (
                    <AccordionItem key={session.id} value={session.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <Card className="w-full mr-4 border-0 shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage src={session.coach_photo_url} alt={session.coach_name} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {session.coach_name?.charAt(0) || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-foreground">
                                    {session.coach_name || "Coach"}
                                  </p>
                                  <Badge variant="outline" className={getStatusBadge(session.status)}>
                                    {session.status}
                                  </Badge>
                                  {session.rating && renderStars(session.rating)}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(session.created_at), "MMM d, yyyy")}
                                  </span>
                                  {session.actual_duration_minutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {session.actual_duration_minutes} min
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Card className="border-primary/20">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={session.coach_photo_url} alt={session.coach_name} />
                                  <AvatarFallback>{session.coach_name?.charAt(0) || "C"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <CardTitle className="text-base">{session.coach_name}</CardTitle>
                                  {session.coach_bio && (
                                    <CardDescription className="line-clamp-2">
                                      {session.coach_bio}
                                    </CardDescription>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRebook(session.coach_id, "text")}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Rebook
                              </Button>
                            </div>
                            
                            {session.rating && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">Your Rating:</span>
                                  {renderStars(session.rating)}
                                </div>
                                {session.feedback && (
                                  <p className="text-sm text-muted-foreground">"{session.feedback}"</p>
                                )}
                              </div>
                            )}
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Transcript</p>
                            {loadingMessages === session.id ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              </div>
                            ) : messages[session.id]?.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No messages in this session.
                              </p>
                            ) : (
                              <ScrollArea className="h-80">
                                <div className="space-y-4 pr-4">
                                  {messages[session.id]?.map((msg) => (
                                    <div
                                      key={msg.id}
                                      className={`flex ${msg.sender_type === "customer" ? "justify-end" : "justify-start"}`}
                                    >
                                      <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                          msg.sender_type === "customer"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}
                                      >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                        <p className={`text-xs mt-1 ${
                                          msg.sender_type === "customer"
                                            ? "text-primary-foreground/70"
                                            : "text-muted-foreground"
                                        }`}>
                                          {format(new Date(msg.created_at), "h:mm a")}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            )}

                            {session.status === "active" && (
                              <Button 
                                className="w-full mt-4"
                                onClick={() => navigate(`/coaching-chat/${session.id}`)}
                              >
                                <ChevronRight className="h-4 w-4 mr-2" />
                                Continue Session
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {/* Phone/Video Sessions */}
            {coachingSessions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Phone & Video Sessions
                </h2>
                <div className="space-y-3">
                  {coachingSessions.map((session) => {
                    const Icon = sessionTypeIcons[session.session_type];
                    return (
                      <Card key={session.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage src={session.coach_photo_url} alt={session.coach_name} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {session.coach_name?.charAt(0) || "C"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-foreground">
                                    {session.coach_name || "Coach"}
                                  </p>
                                  <Badge variant="outline" className="flex items-center gap-1">
                                    <Icon className="h-3 w-3" />
                                    {session.session_type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(session.created_at), "MMM d, yyyy")}
                                  </span>
                                  {session.actual_duration_minutes && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {session.actual_duration_minutes} min
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRebook(session.coach_id, session.session_type)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Rebook
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
