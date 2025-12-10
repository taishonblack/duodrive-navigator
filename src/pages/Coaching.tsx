import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { CoachingCard } from "@/components/CoachingCard";
import { CoachSchedulingForm } from "@/components/CoachSchedulingForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Target, MessageCircle, Phone, Users, Video, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SessionTimer } from "@/components/SessionTimer";
import { format } from "date-fns";

interface ActiveSession {
  id: string;
  session_type: "text" | "phone" | "video";
  scheduled_duration_minutes: number;
  started_at: string | null;
  status: string;
  meet_link: string | null;
  masked_phone_number: string | null;
  coach_name?: string;
}

interface CoachingRequest {
  id: string;
  session_type: "text" | "phone" | "video";
  status: string;
  scheduled_date: string;
  scheduled_time: string;
}

const coachingTiers = [
  {
    title: "Quick Text Help",
    price: 29,
    duration: "10 minutes",
    icon: MessageCircle,
    tier: "quick",
    features: [
      "Text-based consultation",
      "Quick deal review",
      "Fee breakdown analysis",
      "Negotiation tips",
      "Same-day response",
    ],
  },
  {
    title: "Live Phone Session",
    price: 99,
    duration: "30 minutes",
    icon: Phone,
    tier: "live",
    features: [
      "Live phone consultation",
      "In-depth deal analysis",
      "Personalized negotiation strategy",
      "Q&A session",
      "Follow-up summary email",
    ],
    popular: true,
  },
  {
    title: "Full Concierge",
    price: 499,
    duration: "End-to-end support",
    icon: Users,
    tier: "concierge",
    features: [
      "Complete buying assistance",
      "Direct dealer communication",
      "Price negotiation on your behalf",
      "Paperwork review",
      "Financing guidance",
      "Up to 2 weeks of support",
    ],
  },
];

const sessionTypeIcons = {
  text: MessageCircle,
  phone: Phone,
  video: Video,
};

export default function Coaching() {
  const [user, setUser] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [upcomingRequests, setUpcomingRequests] = useState<CoachingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>("");
  const bookingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserAndFetchSessions();
    
    // Check if we need to scroll to booking section (from redirect)
    if (window.location.hash === "#book-session") {
      setTimeout(() => {
        bookingRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  const checkUserAndFetchSessions = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        // Fetch active sessions for this customer
        const { data: sessions, error: sessionsError } = await supabase
          .from("coaching_sessions")
          .select(`
            id,
            session_type,
            scheduled_duration_minutes,
            started_at,
            status,
            meet_link,
            masked_phone_number,
            coach_id
          `)
          .eq("customer_id", currentUser.id)
          .in("status", ["scheduled", "active"])
          .order("created_at", { ascending: false });

        if (!sessionsError && sessions) {
          // Fetch coach names
          const coachIds = sessions.map(s => s.coach_id).filter(Boolean);
          let coachNames: Record<string, string> = {};
          
          if (coachIds.length > 0) {
            const { data: coaches } = await supabase
              .from("coaches")
              .select("id, display_name")
              .in("id", coachIds);
            
            if (coaches) {
              coaches.forEach(c => {
                coachNames[c.id] = c.display_name;
              });
            }
          }

          setActiveSessions(sessions.map(s => ({
            ...s,
            coach_name: s.coach_id ? coachNames[s.coach_id] : undefined,
          })));
        }

        // Fetch upcoming requests
        const { data: requests, error: requestsError } = await supabase
          .from("coaching_requests")
          .select("id, session_type, status, scheduled_date, scheduled_time")
          .eq("customer_id", currentUser.id)
          .in("status", ["pending", "claimed"])
          .order("scheduled_date", { ascending: true });

        if (!requestsError && requests) {
          setUpcomingRequests(requests);
        }
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {/* Active Sessions Banner */}
      {user && !isLoading && (activeSessions.length > 0 || upcomingRequests.length > 0) && (
        <section className="py-6 bg-primary/5 border-b border-primary/10">
          <div className="container mx-auto px-4">
            <h2 className="text-xl font-semibold text-foreground mb-4">Your Coaching Sessions</h2>
            
            {/* Active Sessions with Timer */}
            {activeSessions.filter(s => s.status === "active" && s.started_at).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Active Now</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSessions
                    .filter(s => s.status === "active" && s.started_at)
                    .map((session) => (
                      <div key={session.id} className="space-y-3">
                        <SessionTimer
                          sessionId={session.id}
                          sessionType={session.session_type}
                          scheduledDurationMinutes={session.scheduled_duration_minutes}
                          startedAt={session.started_at}
                          isCoach={false}
                        />
                        {/* Connection Info */}
                        {session.session_type === "video" && session.meet_link && (
                          <Card className="border-primary/20">
                            <CardContent className="p-3">
                              <p className="text-sm text-muted-foreground mb-2">Join your video call:</p>
                              <Button asChild size="sm" className="w-full">
                                <a href={session.meet_link} target="_blank" rel="noopener noreferrer">
                                  <Video className="h-4 w-4 mr-2" />
                                  Join Google Meet
                                </a>
                              </Button>
                            </CardContent>
                          </Card>
                        )}
                        {session.session_type === "phone" && session.masked_phone_number && (
                          <Card className="border-primary/20">
                            <CardContent className="p-3">
                              <p className="text-sm text-muted-foreground mb-1">Call this number:</p>
                              <p className="text-lg font-mono font-semibold text-foreground">
                                {session.masked_phone_number}
                              </p>
                            </CardContent>
                          </Card>
                        )}
                        {session.coach_name && (
                          <p className="text-sm text-muted-foreground text-center">
                            Coach: <span className="font-medium text-foreground">{session.coach_name}</span>
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Scheduled Sessions */}
            {activeSessions.filter(s => s.status === "scheduled").length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Scheduled</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSessions
                    .filter(s => s.status === "scheduled")
                    .map((session) => {
                      const Icon = sessionTypeIcons[session.session_type];
                      return (
                        <Card key={session.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium capitalize">{session.session_type} Session</p>
                                <p className="text-sm text-muted-foreground">
                                  {session.scheduled_duration_minutes} minutes
                                </p>
                              </div>
                              <Badge variant="outline" className="ml-auto">Scheduled</Badge>
                            </div>
                            {session.coach_name && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Coach: {session.coach_name}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Upcoming Requests (pending/claimed) */}
            {upcomingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Upcoming Requests</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {upcomingRequests.map((request) => {
                    const Icon = sessionTypeIcons[request.session_type];
                    return (
                      <Card key={request.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium capitalize text-sm">{request.session_type}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {format(new Date(request.scheduled_date), "MMM d")} at {request.scheduled_time}
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={request.status === "claimed" 
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20" 
                                : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                              }
                            >
                              {request.status === "claimed" ? "Assigned" : "Pending"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Expert Coaching for Your Car Deal
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Sometimes you need a real human in your corner. Our coaches are car buying experts who work exclusively for you — never the dealer.
            </p>
          </div>
        </div>
      </section>

      {/* Coaching Tiers */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {coachingTiers.map((tier, index) => (
              <div
                key={tier.title}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CoachingCard
                  title={tier.title}
                  price={tier.price}
                  duration={tier.duration}
                  features={tier.features}
                  popular={tier.popular}
                  icon={tier.icon}
                  onGetStarted={() => {
                    setSelectedTier(tier.tier);
                    bookingRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">How Coaching Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center animate-fade-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">1. Choose Your Time</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a coaching tier and pick a time that works for you.
              </p>
            </div>
            <div className="text-center animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Upload className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">2. Share Your Deal</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect a deal from your Deal Room or describe your situation.
              </p>
            </div>
            <div className="text-center animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground mx-auto mb-4">
                <Target className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">3. Get Expert Help</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect with your coach and get personalized guidance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section id="book-session" ref={bookingRef} className="py-16 scroll-mt-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">Book a Session</h2>
              <p className="text-muted-foreground">
                Schedule a time that works for you. Our coaches will be ready to help.
              </p>
            </div>
            <CoachSchedulingForm preselectedTier={selectedTier} />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            100% Buyer-Focused
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our coaches are compensated based on your satisfaction, not commissions. They have one goal: helping you get the best possible deal. No upsells, no pressure — just honest advice.
          </p>
        </div>
      </section>
    </Layout>
  );
}
