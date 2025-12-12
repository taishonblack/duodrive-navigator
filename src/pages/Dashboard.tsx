import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/ScoreRing";
import { CustomerCoachUpdates } from "@/components/CustomerCoachUpdates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Car, 
  TrendingUp, 
  MessageSquare, 
  Calendar, 
  ArrowRight,
  FileText,
  Phone,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Scale
} from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { User } from "@supabase/supabase-js";

interface Deal {
  id: string;
  name: string;
  year: string | null;
  make: string | null;
  model: string | null;
  asking_price: string | null;
  score_result: {
    overallScore?: number;
    pillarScores?: {
      depreciation?: number;
      reliability?: number;
      safety?: number;
      dealHealth?: number;
      affordability?: number;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

interface CoachingRequest {
  id: string;
  session_type: "text" | "phone" | "video";
  status: "pending" | "claimed" | "in_progress" | "completed" | "cancelled";
  scheduled_date: string;
  scheduled_time: string;
  created_at: string;
  notes: string | null;
}

const sessionTypeIcons = {
  text: MessageSquare,
  phone: Phone,
  video: Video,
};

const sessionTypeLabels = {
  text: "Quick Text Help",
  phone: "Live Phone Session",
  video: "Video Consultation",
};

const statusConfig = {
  pending: { icon: Clock, label: "Pending", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  claimed: { icon: AlertCircle, label: "Assigned", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  in_progress: { icon: AlertCircle, label: "In Progress", color: "bg-primary/10 text-primary border-primary/20" },
  completed: { icon: CheckCircle2, label: "Completed", color: "bg-score-excellent/10 text-score-excellent border-score-excellent/20" },
  cancelled: { icon: XCircle, label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [coachingRequests, setCoachingRequests] = useState<CoachingRequest[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadData = async (userId: string) => {
    setIsLoading(true);
    try {
      const [dealsResponse, coachingResponse] = await Promise.all([
        supabase
          .from("deals")
          .select("id, name, year, make, model, asking_price, score_result, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("coaching_requests")
          .select("id, session_type, status, scheduled_date, scheduled_time, created_at, notes")
          .eq("customer_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (dealsResponse.error) throw dealsResponse.error;
      if (coachingResponse.error) throw coachingResponse.error;

      setDeals(dealsResponse.data as Deal[] || []);
      setCoachingRequests(coachingResponse.data as CoachingRequest[] || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare chart data from deals with scores
  const scoreChartData = deals
    .filter(deal => deal.score_result?.overallScore)
    .map(deal => ({
      date: format(new Date(deal.created_at), "MMM d"),
      score: deal.score_result?.overallScore || 0,
      name: deal.name,
    }))
    .reverse()
    .slice(-10); // Last 10 deals

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-score-excellent";
    if (score >= 60) return "text-score-good";
    if (score >= 40) return "text-score-caution";
    return "text-score-risky";
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const averageScore = scoreChartData.length > 0
    ? Math.round(scoreChartData.reduce((acc, d) => acc + d.score, 0) / scoreChartData.length)
    : null;

  return (
    <Layout>
      <SEO 
        title="Dashboard"
        description="Track your saved car deals, DuoDrive scores, and coaching sessions. Monitor your car buying progress in one place."
        canonical="/dashboard"
        noIndex
      />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your deals, scores, and coaching sessions
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Car className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{deals.length}</p>
                  <p className="text-sm text-muted-foreground">Saved Deals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-score-excellent/10">
                  <TrendingUp className="h-6 w-6 text-score-excellent" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${averageScore ? getScoreColor(averageScore) : "text-muted-foreground"}`}>
                    {averageScore ?? "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <MessageSquare className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{coachingRequests.length}</p>
                  <p className="text-sm text-muted-foreground">Coaching Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Score Trends Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Score Trends
              </CardTitle>
              <CardDescription>Your DuoDrive scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              {scoreChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis 
                        dataKey="date" 
                        className="text-muted-foreground"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        className="text-muted-foreground"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number, name: string, props: any) => [
                          `Score: ${value}`,
                          props.payload.name
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">No scored deals yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/deal-room">
                      Evaluate Your First Deal
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Deals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-primary" />
                  Saved Deals
                </CardTitle>
                <CardDescription>Your recent deal evaluations</CardDescription>
              </div>
              <div className="flex gap-2">
                {deals.length >= 2 && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/compare">
                      <Scale className="h-4 w-4 mr-1" />
                      Compare
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/deal-room">
                    New Deal
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {deals.length > 0 ? (
                <div className="space-y-3">
                  {deals.slice(0, 5).map((deal) => (
                    <div 
                      key={deal.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{deal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {[deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "No vehicle info"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(deal.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      {deal.score_result?.overallScore ? (
                        <div className="ml-4">
                          <ScoreRing score={deal.score_result.overallScore} size="sm" />
                        </div>
                      ) : (
                        <Badge variant="outline" className="ml-4">Not Scored</Badge>
                      )}
                    </div>
                  ))}
                  {deals.length > 5 && (
                    <Button asChild variant="ghost" className="w-full mt-2">
                      <Link to="/deal-room">
                        View All {deals.length} Deals
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">No saved deals yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/deal-room">
                      Start Your First Deal
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coaching Sessions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Coaching Sessions
                </CardTitle>
                <CardDescription>Your coaching history</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/coaching">
                  Book Session
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {coachingRequests.length > 0 ? (
                <div className="space-y-3">
                  {coachingRequests.slice(0, 5).map((request) => {
                    const SessionIcon = sessionTypeIcons[request.session_type];
                    const status = statusConfig[request.status];
                    const StatusIcon = status.icon;
                    
                    return (
                      <div 
                        key={request.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                            <SessionIcon className="h-5 w-5 text-accent-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {sessionTypeLabels[request.session_type]}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(request.scheduled_date), "MMM d, yyyy")} at {request.scheduled_time}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    );
                  })}
                  {coachingRequests.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      + {coachingRequests.length - 5} more sessions
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">No coaching sessions yet</p>
                  <Button asChild variant="outline" className="mt-4">
                    <Link to="/coaching">
                      Book Your First Session
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coach Updates - Full Width */}
          {user && (
            <div className="lg:col-span-2">
              <CustomerCoachUpdates userId={user.id} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
