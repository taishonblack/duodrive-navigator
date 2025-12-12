import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Calendar, MessageSquare, Plus, X } from "lucide-react";

interface CustomerUpdateFormProps {
  customerId: string;
  customerName: string;
  coachId: string;
  requestId?: string;
  onSuccess?: () => void;
}

export function CustomerUpdateForm({ 
  customerId, 
  customerName, 
  coachId, 
  requestId,
  onSuccess 
}: CustomerUpdateFormProps) {
  const [updateType, setUpdateType] = useState<"update" | "schedule_request">("update");
  const [message, setMessage] = useState("");
  const [proposedTimes, setProposedTimes] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTimeSlot = () => {
    setProposedTimes([...proposedTimes, ""]);
  };

  const removeTimeSlot = (index: number) => {
    setProposedTimes(proposedTimes.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index: number, value: string) => {
    const updated = [...proposedTimes];
    updated[index] = value;
    setProposedTimes(updated);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (updateType === "schedule_request" && proposedTimes.every(t => !t.trim())) {
      toast.error("Please add at least one proposed time");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get coach display name
      const { data: coach } = await supabase
        .from("coaches")
        .select("display_name")
        .eq("id", coachId)
        .single();

      const filteredTimes = proposedTimes.filter(t => t.trim());

      // Create the update record
      const { data: update, error: insertError } = await supabase
        .from("coach_customer_updates")
        .insert({
          coach_id: coachId,
          customer_id: customerId,
          request_id: requestId,
          update_type: updateType,
          message: message.trim(),
          proposed_times: updateType === "schedule_request" ? filteredTimes : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send notification email (with authorization)
      const { data: { session } } = await supabase.auth.getSession();
      const { error: notifyError } = await supabase.functions.invoke("send-customer-update", {
        body: {
          updateId: update.id,
          customerId,
          coachName: coach?.display_name || "Your Coach",
          message: message.trim(),
          updateType,
          proposedTimes: filteredTimes,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      if (notifyError) {
        console.error("Notification error:", notifyError);
        // Don't fail the whole operation if notification fails
      }

      toast.success(
        updateType === "schedule_request" 
          ? "Schedule request sent to customer" 
          : "Update sent to customer"
      );
      
      setMessage("");
      setProposedTimes([""]);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending update:", error);
      toast.error("Failed to send update");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Send Update to {customerName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Update Type</Label>
          <RadioGroup 
            value={updateType} 
            onValueChange={(v) => setUpdateType(v as "update" | "schedule_request")}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="update" id="update" />
              <Label htmlFor="update" className="flex items-center gap-1 cursor-pointer">
                <MessageSquare className="h-4 w-4" />
                General Update
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="schedule_request" id="schedule" />
              <Label htmlFor="schedule" className="flex items-center gap-1 cursor-pointer">
                <Calendar className="h-4 w-4" />
                Request Call Time
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder={
              updateType === "schedule_request"
                ? "I'd like to discuss some great options I found for you..."
                : "Here's an update on your car search..."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </div>

        {updateType === "schedule_request" && (
          <div className="space-y-2">
            <Label>Proposed Times</Label>
            <p className="text-sm text-muted-foreground">
              Add time options for the customer to choose from
            </p>
            {proposedTimes.map((time, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="e.g., Tuesday 3pm EST, Wednesday 10am EST"
                  value={time}
                  onChange={(e) => updateTimeSlot(index, e.target.value)}
                />
                {proposedTimes.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTimeSlot(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTimeSlot}
              className="mt-2"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Another Time
            </Button>
          </div>
        )}

        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {isSubmitting ? "Sending..." : "Send Update"}
        </Button>
      </CardContent>
    </Card>
  );
}
