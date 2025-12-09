import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, MessageSquare, Phone, Video, Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoachSchedulingFormProps {
  dealId?: string;
}

const sessionTypes = [
  { value: "text", label: "Text Coaching", icon: MessageSquare, description: "Quick text-based help", price: "$29" },
  { value: "phone", label: "Phone Session", icon: Phone, description: "30-minute live call", price: "$99" },
  { value: "video", label: "Video Chat", icon: Video, description: "Full concierge service", price: "$499" },
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

export function CoachSchedulingForm({ dealId }: CoachSchedulingFormProps) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState<string>("");
  const [sessionType, setSessionType] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!date || !time || !sessionType || !phone || !email) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Login required",
          description: "Please log in to schedule a coaching session.",
          variant: "destructive",
        });
        return;
      }

      const { data: insertedRequest, error } = await supabase.from("coaching_requests").insert({
        customer_id: user.id,
        deal_id: dealId || null,
        session_type: sessionType as "text" | "phone" | "video",
        scheduled_date: format(date, "yyyy-MM-dd"),
        scheduled_time: time,
        phone_number: phone,
        email: email,
        notes: notes || null,
      }).select().single();

      if (error) throw error;

      // Send confirmation email to customer
      if (insertedRequest) {
        try {
          await supabase.functions.invoke("send-session-reminder", {
            body: { requestId: insertedRequest.id, reminderType: "session_scheduled" },
          });
        } catch (emailError) {
          console.error("Failed to send confirmation email:", emailError);
          // Don't fail the submission if email fails
        }
      }

      setIsSubmitted(true);
      toast({
        title: "Request submitted!",
        description: "A coach will review your deal and reach out at your scheduled time.",
      });
    } catch (error: any) {
      console.error("Error scheduling:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border shadow-card text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Request Submitted!</h3>
        <p className="text-muted-foreground mb-4">
          A coach will review your deal and contact you at {date && format(date, "PPP")} at {time}.
        </p>
        <Button variant="outline" onClick={() => setIsSubmitted(false)}>
          Schedule Another Session
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Schedule a Coach Session</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Ready to talk to a human? Our expert coaches will review your deal and help you make the best decision.
      </p>

      <div className="space-y-6">
        {/* Session Type Selection */}
        <div className="space-y-2">
          <Label>Session Type *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {sessionTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setSessionType(type.value)}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all",
                    sessionType === type.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 mb-2",
                    sessionType === type.value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <p className="font-medium text-foreground text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                  <p className="text-sm font-semibold text-primary mt-1">{type.price}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Preferred Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Preferred Time *</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot.split(":")[0] >= "12" 
                      ? `${parseInt(slot.split(":")[0]) === 12 ? 12 : parseInt(slot.split(":")[0]) - 12}:${slot.split(":")[1]} PM`
                      : `${parseInt(slot.split(":")[0])}:${slot.split(":")[1]} AM`
                    }
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone Number *</Label>
            <Input
              type="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email Address *</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Additional Notes (Optional)</Label>
          <Textarea
            placeholder="Any specific questions or concerns about your deal?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !date || !time || !sessionType || !phone || !email}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Schedule Coaching Session"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          A coach will have time to review your deal before your session.
        </p>
      </div>
    </div>
  );
}