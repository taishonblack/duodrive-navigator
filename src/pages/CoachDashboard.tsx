import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, MessageSquare, Phone, Video, Clock, Calendar, 
  Loader2, CheckCircle, XCircle, LogOut, RefreshCw 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CoachingRequest {
  id: string;
  session_type: "text" | "phone" | "video";
  status: "pending" | "claimed" | "in_progress" | "completed" | "cancelled";
  scheduled_date: string;
  scheduled_time: string;
  phone_number: string;
  email: string;
  notes: string | null;
  created_at: string;
  claimed_at: string | null;
  deal_id: string | null;
}

interface Coach {
  id: string;
  display_name: string;
  tier: string;
  is_available: boolean;
}

const sessionTypeIcons = {
  text: MessageSquare,
  phone: Phone,
  video: Video,
};

const sessionTypeLabels = {
  text: "Text Coaching",
  phone: "Phone Session",
  video: "Video Chat",
};

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  claimed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  in_progress: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  completed: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [pendingRequests, setPendingRequests] = useState<CoachingRequest[]>([]);
  const [myRequests, setMyRequests] = useState<CoachingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkCoachAccess();
  }, []);

  const checkCoachAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/coach");
        return;
      }

      // Verify coach role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "coach")
        .single();

      if (roleError || !roleData) {
        toast({
          title: "Access denied",
          description: "You don't have coach permissions.",
          variant: "destructive",
        });
        navigate("/coach");
        return;
      }

      // Get coach profile
      const { data: coachData, error: coachError } = await supabase
        .from("coaches")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (coachError || !coachData) {
        toast({
          title: "Profile not found",
          description: "Coach profile not set up. Please contact an administrator.",
          variant: "destructive",
        });
        return;
      }

      setCoach(coachData);
      await fetchRequests(coachData.id);
    } catch (error) {
      console.error("Error:", error);
      navigate("/coach");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRequests = async (coachId: string) => {
    try {
      // Fetch pending requests (queue)
      const { data: pending, error: pendingError } = await supabase
        .from("coaching_requests")
        .select("*")
        .eq("status", "pending")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (pendingError) throw pendingError;
      setPendingRequests(pending || []);

      // Fetch my claimed requests
      const { data: mine, error: mineError } = await supabase
        .from("coaching_requests")
        .select("*")
        .eq("coach_id", coachId)
        .neq("status", "pending")
        .order("scheduled_date", { ascending: true });

      if (mineError) throw mineError;
      setMyRequests(mine || []);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "Failed to load requests.",
        variant: "destructive",
      });
    }
  };

  const claimRequest = async (requestId: string) => {
    if (!coach) return;
    setActionLoading(requestId);

    try {
      const { error } = await supabase
        .from("coaching_requests")
        .update({
          coach_id: coach.id,
          status: "claimed",
          claimed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "pending");

      if (error) throw error;

      toast({
        title: "Request claimed!",
        description: "This request has been assigned to you.",
      });

      await fetchRequests(coach.id);
    } catch (error: any) {
      console.error("Error claiming:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to claim request.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (requestId: string, newStatus: "in_progress" | "completed" | "cancelled") => {
    if (!coach) return;
    setActionLoading(requestId);

    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("coaching_requests")
        .update(updateData)
        .eq("id", requestId)
        .eq("coach_id", coach.id);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Request marked as ${newStatus.replace("_", " ")}.`,
      });

      await fetchRequests(coach.id);
    } catch (error: any) {
      console.error("Error updating:", error);
      toast({
        title: "Error",
        description: "Failed to update status.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/coach");
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Coach Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {coach?.display_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => coach && fetchRequests(coach.id)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
                  <p className="text-sm text-muted-foreground">In Queue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {myRequests.filter(r => r.status === "claimed" || r.status === "in_progress").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {myRequests.filter(r => r.status === "completed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {myRequests.filter(r => 
                      (r.status === "claimed" || r.status === "in_progress") && 
                      r.scheduled_date === format(new Date(), "yyyy-MM-dd")
                    ).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList>
            <TabsTrigger value="queue">
              Queue ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="my-requests">
              My Requests ({myRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending requests in queue.</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => {
                const Icon = sessionTypeIcons[request.session_type];
                return (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground">
                                {sessionTypeLabels[request.session_type]}
                              </p>
                              <Badge variant="outline" className={statusColors.pending}>
                                Pending
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(request.scheduled_date), "PPP")} at {request.scheduled_time}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.email} • {request.phone_number}
                            </p>
                            {request.notes && (
                              <p className="text-sm text-foreground mt-2 p-2 bg-muted rounded">
                                "{request.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => claimRequest(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          {actionLoading === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Claim Request"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="my-requests" className="space-y-4">
            {myRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">You haven't claimed any requests yet.</p>
                </CardContent>
              </Card>
            ) : (
              myRequests.map((request) => {
                const Icon = sessionTypeIcons[request.session_type];
                return (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-foreground">
                                {sessionTypeLabels[request.session_type]}
                              </p>
                              <Badge variant="outline" className={statusColors[request.status]}>
                                {request.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(request.scheduled_date), "PPP")} at {request.scheduled_time}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {request.email} • {request.phone_number}
                            </p>
                            {request.notes && (
                              <p className="text-sm text-foreground mt-2 p-2 bg-muted rounded">
                                "{request.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                        {request.status !== "completed" && request.status !== "cancelled" && (
                          <div className="flex gap-2">
                            {request.status === "claimed" && (
                              <Button
                                variant="outline"
                                onClick={() => updateStatus(request.id, "in_progress")}
                                disabled={actionLoading === request.id}
                              >
                                Start Session
                              </Button>
                            )}
                            <Button
                              onClick={() => updateStatus(request.id, "completed")}
                              disabled={actionLoading === request.id}
                            >
                              {actionLoading === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Complete
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateStatus(request.id, "cancelled")}
                              disabled={actionLoading === request.id}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}