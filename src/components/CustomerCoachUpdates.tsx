import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageSquare, Calendar, Clock, CheckCircle, Video, 
  Loader2, ChevronRight, Bell
} from "lucide-react";
import { format, addMinutes } from "date-fns";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { CalendarEvent } from "@/lib/calendarExport";

interface CoachUpdate {
  id: string;
  coach_id: string;
  update_type: "update" | "schedule_request";
  message: string;
  proposed_times: string[] | null;
  customer_selected_time: string | null;
  meet_link: string | null;
  status: string;
  created_at: string;
  coach_name?: string;
}

interface CustomerCoachUpdatesProps {
  userId: string;
}

export function CustomerCoachUpdates({ userId }: CustomerCoachUpdatesProps) {
  const [updates, setUpdates] = useState<CoachUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectingTime, setSelectingTime] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdates();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("customer-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coach_customer_updates",
          filter: `customer_id=eq.${userId}`,
        },
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from("coach_customer_updates")
        .select("*")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch coach names
      if (data && data.length > 0) {
        const coachIds = [...new Set(data.map(u => u.coach_id))];
        const { data: coaches } = await supabase
          .from("coaches")
          .select("id, display_name")
          .in("id", coachIds);

        const coachMap: Record<string, string> = {};
        coaches?.forEach(c => {
          coachMap[c.id] = c.display_name;
        });

        setUpdates(data.map(u => ({
          ...u,
          update_type: u.update_type as "update" | "schedule_request",
          proposed_times: u.proposed_times as string[] | null,
          coach_name: coachMap[u.coach_id] || "Your Coach",
        })));
      } else {
        setUpdates([]);
      }
    } catch (error) {
      console.error("Error fetching updates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectTime = async (updateId: string, selectedTime: string) => {
    setSelectingTime(updateId);

    try {
      // Update the record with selected time
      const { error: updateError } = await supabase
        .from("coach_customer_updates")
        .update({
          customer_selected_time: new Date().toISOString(),
          status: "responded",
        })
        .eq("id", updateId);

      if (updateError) throw updateError;

      // Trigger Meet link generation
      const { data: { session } } = await supabase.auth.getSession();
      const { error: meetError } = await supabase.functions.invoke("generate-meeting-link", {
        body: { updateId, selectedTime },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (meetError) {
        console.error("Meet generation error:", meetError);
        // Don't fail - the coach can still be notified
      }

      toast.success("Time selected! Your coach will send you a Google Meet link.");
      fetchUpdates();
    } catch (error: any) {
      console.error("Error selecting time:", error);
      toast.error("Failed to select time. Please try again.");
    } finally {
      setSelectingTime(null);
    }
  };

  const markAsRead = async (updateId: string) => {
    try {
      await supabase
        .from("coach_customer_updates")
        .update({ status: "read" })
        .eq("id", updateId)
        .eq("status", "pending");
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (updates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Coach Updates
          </CardTitle>
          <CardDescription>Messages and scheduling requests from your coach</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No updates from your coach yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingUpdates = updates.filter(u => u.status === "pending" || u.status === "read");
  const respondedUpdates = updates.filter(u => u.status === "responded" || u.status === "completed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Coach Updates
          {pendingUpdates.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingUpdates.length} new
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Messages and scheduling requests from your coach</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingUpdates.map((update) => (
          <div
            key={update.id}
            className="p-4 rounded-lg border border-primary/20 bg-primary/5"
            onMouseEnter={() => update.status === "pending" && markAsRead(update.id)}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                {update.update_type === "schedule_request" ? (
                  <Calendar className="h-5 w-5 text-primary" />
                ) : (
                  <MessageSquare className="h-5 w-5 text-primary" />
                )}
                <span className="font-medium text-foreground">{update.coach_name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(update.created_at), "MMM d, h:mm a")}
              </span>
            </div>
            
            <p className="text-sm text-foreground mb-3">{update.message}</p>
            
            {update.update_type === "schedule_request" && update.proposed_times && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Select a time:</p>
                <div className="flex flex-wrap gap-2">
                  {update.proposed_times.map((time, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => selectTime(update.id, time)}
                      disabled={selectingTime === update.id}
                      className="text-xs"
                    >
                      {selectingTime === update.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {respondedUpdates.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-3">Previous Updates</p>
            {respondedUpdates.slice(0, 5).map((update) => (
              <div
                key={update.id}
                className="p-3 rounded-lg bg-muted/50 mb-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {update.status === "completed" && update.meet_link ? (
                      <Video className="h-4 w-4 text-green-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium text-foreground">{update.coach_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(update.created_at), "MMM d")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{update.message}</p>
                
                {update.meet_link && (
                  <div className="flex items-center gap-2 mt-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={update.meet_link} target="_blank" rel="noopener noreferrer">
                        <Video className="h-3 w-3 mr-1" />
                        Join Meeting
                      </a>
                    </Button>
                    {update.customer_selected_time && (
                      <AddToCalendarButton
                        event={{
                          title: `DuoDrive Coaching Session with ${update.coach_name}`,
                          description: update.message,
                          startTime: new Date(update.customer_selected_time),
                          endTime: addMinutes(new Date(update.customer_selected_time), 30),
                          meetLink: update.meet_link,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
