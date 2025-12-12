import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { CoachChatSession } from "@/components/CoachChatSession";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function CoachingChat() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [coachInfo, setCoachInfo] = useState<{ name: string; avatar?: string } | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAccess();
  }, [sessionId]);

  const checkAccess = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);

      // Check if this user has access to this session
      const { data: session, error: sessionError } = await supabase
        .from("coach_chat_sessions")
        .select(`
          id,
          customer_id,
          coach_id,
          status
        `)
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        setError("Chat session not found or you don't have access.");
        setIsLoading(false);
        return;
      }

      // Check if user is the customer
      if (session.customer_id === currentUser.id) {
        setIsCoach(false);
        
        // Get coach info
        const { data: coach } = await supabase
          .from("coaches")
          .select("display_name")
          .eq("id", session.coach_id)
          .single();
        
        if (coach) {
          setCoachInfo({ name: coach.display_name });
        }
        
        setIsLoading(false);
        return;
      }

      // Check if user is the coach
      const { data: coachData } = await supabase
        .from("coaches")
        .select("id, display_name")
        .eq("user_id", currentUser.id)
        .single();

      if (coachData && coachData.id === session.coach_id) {
        setIsCoach(true);
        setCoachInfo({ name: coachData.display_name });
        setIsLoading(false);
        return;
      }

      // Check if admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .eq("role", "admin")
        .single();

      if (roleData) {
        // Admin can view but treat as observer
        setIsCoach(false);
        setIsLoading(false);
        return;
      }

      setError("You don't have access to this chat session.");
      setIsLoading(false);
    } catch (err) {
      console.error("Access check error:", err);
      setError("An error occurred while checking access.");
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
    // Save current URL to redirect back after login
    sessionStorage.setItem("redirectAfterAuth", window.location.pathname);
    navigate("/auth");
  };

  const handleSessionEnd = () => {
    toast({
      title: "Session Complete",
      description: "Your coaching chat session has ended.",
    });
    
    // Redirect based on role
    if (isCoach) {
      navigate("/coach/dashboard");
    } else {
      navigate("/coaching");
    }
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
          title="Coaching Chat - Login Required"
          description="Log in to access your coaching chat session."
          noIndex
        />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <LogIn className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Login Required</h2>
              <p className="text-muted-foreground mb-6">
                Please log in to access your coaching chat session.
              </p>
              <Button onClick={handleLogin} className="w-full">
                Log In to Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <SEO 
          title="Chat Session Error"
          description="Unable to access chat session."
          noIndex
        />
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => navigate("/coaching")}>
                Go to Coaching
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
        title="Coaching Chat Session"
        description="Live text coaching session with your DuoDrive coach."
        noIndex
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {isCoach ? "Coaching Session" : "Chat with Your Coach"}
          </h1>
          <p className="text-muted-foreground">
            {isCoach 
              ? "Help your customer with their car deal" 
              : "Get personalized help with your car buying decision"}
          </p>
        </div>

        <CoachChatSession
          sessionId={sessionId!}
          isCoach={isCoach}
          coachName={coachInfo?.name}
          coachAvatar={coachInfo?.avatar}
          onSessionEnd={handleSessionEnd}
        />
      </div>
    </Layout>
  );
}
