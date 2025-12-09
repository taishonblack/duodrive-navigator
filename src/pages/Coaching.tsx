import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { CoachingCard } from "@/components/CoachingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Upload, Target, MessageCircle, Phone, Users, Loader2, Video } from "lucide-react";
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

  useEffect(() => {
    checkUserAndFetchSessions();
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
                Upload your quote and share any concerns or questions.
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
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-xl mx-auto">
            <div className="p-8 rounded-2xl bg-card border border-border shadow-elevated">
              <h2 className="text-2xl font-semibold text-foreground text-center mb-6">
                Book a Session
              </h2>
              <form className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input id="name" placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" placeholder="(555) 123-4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tier">Coaching Tier</Label>
                  <select
                    id="tier"
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="quick">Quick Text Help - $29</option>
                    <option value="live">Live Phone Session - $99</option>
                    <option value="concierge">Full Concierge - $499</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">What do you need help with?</Label>
                  <Textarea
                    id="goals"
                    placeholder="Tell us about your deal and what questions you have..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upload Documents (optional)</Label>
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Continue to Booking
                </Button>
              </form>
            </div>
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
