import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Check, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoogleCalendarConnectProps {
  coachId: string;
}

export function GoogleCalendarConnect({ coachId }: GoogleCalendarConnectProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
    
    // Check for success callback
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast({
        title: "Google Calendar Connected!",
        description: "You can now generate Meet links for video sessions.",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkConnectionStatus();
    }
  }, [coachId]);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("coach_integrations")
        .select("google_connected")
        .eq("coach_id", coachId)
        .maybeSingle();

      if (error) throw error;
      setIsConnected(data?.google_connected ?? false);
    } catch (error) {
      console.error("Error checking Google connection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      // Get a cryptographically signed state token from the server
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to connect Google Calendar.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const response = await supabase.functions.invoke("generate-oauth-state");
      
      if (response.error || !response.data?.state) {
        throw new Error(response.error?.message || "Failed to generate OAuth state");
      }

      const signedState = response.data.state;
      
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-callback`;
      const scope = encodeURIComponent(
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar"
      );
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(signedState)}`;

      window.location.href = authUrl;
    } catch (error: any) {
      console.error("Error initiating OAuth:", error);
      toast({
        title: "Connection Error",
        description: "Failed to start Google connection. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Only update the google_connected flag - tokens are in separate secure table
      const { error } = await supabase
        .from("coach_integrations")
        .update({
          google_connected: false,
          updated_at: new Date().toISOString(),
        })
        .eq("coach_id", coachId);

      if (error) throw error;

      setIsConnected(false);
      toast({
        title: "Disconnected",
        description: "Google Calendar has been disconnected.",
      });
    } catch (error: any) {
      console.error("Error disconnecting:", error);
      toast({
        title: "Error",
        description: "Failed to disconnect Google Calendar.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Google Calendar</CardTitle>
              <CardDescription className="text-sm">
                Generate Meet links for video sessions
              </CardDescription>
            </div>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Your Google Calendar is connected. Meet links will be generated automatically for video sessions.
            </p>
            <Button variant="ghost" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to automatically create Google Meet links for video coaching sessions.
            </p>
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Google Calendar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
