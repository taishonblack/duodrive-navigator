import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, MessageSquare, Phone, Video, Loader2, CheckCircle, Clock, Sun, Sunset, Moon, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoachSchedulingFormProps {
  dealId?: string;
  preselectedTier?: string;
}

interface Deal {
  id: string;
  name: string;
  year: string | null;
  make: string | null;
  model: string | null;
}

const sessionTypes = [
  { value: "text", label: "Text Coaching", icon: MessageSquare, description: "Quick text-based help", price: "$29", tier: "quick" },
  { value: "phone", label: "Phone Session", icon: Phone, description: "30-minute live call", price: "$99", tier: "live" },
  { value: "video", label: "Video Chat", icon: Video, description: "Full concierge service", price: "$499", tier: "concierge" },
];

const timePreferences = [
  { value: "morning", label: "Morning", icon: Sun, description: "8:00 AM - 12:00 PM", times: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"] },
  { value: "afternoon", label: "Afternoon", icon: Sunset, description: "12:00 PM - 5:00 PM", times: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"] },
  { value: "evening", label: "Evening", icon: Moon, description: "5:00 PM - 8:00 PM", times: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30"] },
];

const PENDING_BOOKING_KEY = "duodrive_pending_booking";

export function CoachSchedulingForm({ dealId, preselectedTier }: CoachSchedulingFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [userDeals, setUserDeals] = useState<Deal[]>([]);
  const [date, setDate] = useState<Date>();
  const [timePreference, setTimePreference] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [sessionType, setSessionType] = useState<string>("");
  const [selectedDealId, setSelectedDealId] = useState<string>(dealId || "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Check for payment success/cancel on mount
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const paymentSessionType = searchParams.get("session_type");
    
    if (paymentStatus === "success" && paymentSessionType) {
      toast({
        title: "Payment Successful!",
        description: paymentSessionType === "video" 
          ? "Your 20% deposit has been processed. We'll charge the remaining 80% after your session." 
          : "Your coaching session has been paid for. A coach will contact you soon.",
      });
      setIsSubmitted(true);
    } else if (paymentStatus === "cancelled") {
      toast({
        title: "Payment Cancelled",
        description: "Your payment was cancelled. You can try again when ready.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast]);

  // Check for pending booking data on mount
  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        // Check for pending booking data
        const pendingBooking = localStorage.getItem(PENDING_BOOKING_KEY);
        if (pendingBooking) {
          try {
            const bookingData = JSON.parse(pendingBooking);
            if (bookingData.date) setDate(new Date(bookingData.date));
            if (bookingData.timePreference) setTimePreference(bookingData.timePreference);
            if (bookingData.time) setTime(bookingData.time);
            if (bookingData.sessionType) setSessionType(bookingData.sessionType);
            if (bookingData.phone) setPhone(bookingData.phone);
            if (bookingData.email) setEmail(bookingData.email);
            if (bookingData.notes) setNotes(bookingData.notes);
            if (bookingData.selectedDealId) setSelectedDealId(bookingData.selectedDealId);
            localStorage.removeItem(PENDING_BOOKING_KEY);
            toast({
              title: "Welcome back!",
              description: "Your booking information has been restored.",
            });
          } catch (e) {
            console.error("Error parsing pending booking:", e);
          }
        }

        // Pre-fill email from user
        if (currentUser.email && !email) {
          setEmail(currentUser.email);
        }

        // Load user's deals
        loadUserDeals(currentUser.id);
      }
    };

    checkAuthAndLoadData();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserDeals(session.user.id);
        if (session.user.email && !email) {
          setEmail(session.user.email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Set preselected tier
  useEffect(() => {
    if (preselectedTier) {
      const matchedType = sessionTypes.find(t => t.tier === preselectedTier);
      if (matchedType) {
        setSessionType(matchedType.value);
      }
    }
  }, [preselectedTier]);

  const loadUserDeals = async (userId: string) => {
    setIsLoadingDeals(true);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, year, make, model")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setUserDeals(data);
      }
    } catch (error) {
      console.error("Error loading deals:", error);
    } finally {
      setIsLoadingDeals(false);
    }
  };

  const getAvailableTimes = () => {
    if (!timePreference) return [];
    const pref = timePreferences.find(p => p.value === timePreference);
    return pref?.times || [];
  };

  const formatTime = (slot: string) => {
    const hour = parseInt(slot.split(":")[0]);
    const minutes = slot.split(":")[1];
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const handleContinueBooking = () => {
    if (!user) {
      // Save booking data to localStorage before redirecting
      const bookingData = {
        date: date?.toISOString(),
        timePreference,
        time,
        sessionType,
        phone,
        email,
        notes,
        selectedDealId,
      };
      localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(bookingData));
      
      toast({
        title: "Account Required",
        description: "Please sign in or create an account to complete your booking.",
      });
      
      navigate("/auth?redirect=/coaching#book-session");
      return;
    }

    // User is logged in, proceed with submission
    handleSubmit();
  };

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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        toast({
          title: "Login required",
          description: "Please log in to schedule a coaching session.",
          variant: "destructive",
        });
        return;
      }

      // First, create the coaching request
      const { data: insertedRequest, error } = await supabase.from("coaching_requests").insert({
        customer_id: currentUser.id,
        deal_id: selectedDealId || null,
        session_type: sessionType as "text" | "phone" | "video",
        scheduled_date: format(date, "yyyy-MM-dd"),
        scheduled_time: time,
        phone_number: phone,
        email: email,
        notes: notes || null,
      }).select().single();

      if (error) throw error;

      // Now redirect to Stripe checkout
      setIsProcessingPayment(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        "create-coaching-checkout",
        {
          body: { 
            sessionType, 
            requestId: insertedRequest.id 
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (checkoutError) throw checkoutError;
      if (!checkoutData?.url) throw new Error("No checkout URL returned");

      // Send confirmation email to customer (fire and forget)
      try {
        await supabase.functions.invoke("send-session-reminder", {
          body: { requestId: insertedRequest.id, reminderType: "session_scheduled" },
        });
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
      }

      // Notify available coaches about the new request (fire and forget)
      try {
        await supabase.functions.invoke("notify-coaches", {
          body: { requestId: insertedRequest.id },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });
      } catch (notifyError) {
        console.error("Failed to notify coaches:", notifyError);
      }

      // Redirect to Stripe checkout
      window.open(checkoutData.url, "_blank");
      
      toast({
        title: "Redirecting to payment...",
        description: "Complete your payment in the new tab to confirm your booking.",
      });

      setIsSubmitting(false);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error("Error scheduling:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="p-8 rounded-2xl bg-card border border-border shadow-card text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Request Submitted!</h3>
        <p className="text-muted-foreground mb-4">
          A coach will review your deal and contact you at {date && format(date, "PPP")} at {formatTime(time)}.
        </p>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
            <Clock className="h-4 w-4" />
            <span className="font-medium text-sm">Please allow response time</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Our coaches typically respond within 2-4 hours during business hours. Thank you for your patience!
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsSubmitted(false)}>
          Schedule Another Session
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-card border border-border shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-2">Schedule a Coach Session</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Ready to talk to a human? Our expert coaches will review your deal and help you make the best decision.
      </p>

      {/* Response time notice */}
      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Coaches typically respond within 2-4 business hours</span>
        </div>
      </div>

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

        {/* Date Selection */}
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

        {/* Time Preference Selection */}
        <div className="space-y-2">
          <Label>When works best for you? *</Label>
          <div className="grid grid-cols-3 gap-3">
            {timePreferences.map((pref) => {
              const Icon = pref.icon;
              return (
                <button
                  key={pref.value}
                  type="button"
                  onClick={() => {
                    setTimePreference(pref.value);
                    setTime(""); // Reset specific time when preference changes
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    timePreference === pref.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 mx-auto mb-1",
                    timePreference === pref.value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <p className="font-medium text-foreground text-sm">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Specific Time Selection */}
        {timePreference && (
          <div className="space-y-2">
            <Label>Select a specific time *</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time" />
              </SelectTrigger>
              <SelectContent>
                {getAvailableTimes().map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {formatTime(slot)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Deal Selection (for logged in users) */}
        {user && userDeals.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Connect a Deal (Optional)
            </Label>
            <Select value={selectedDealId} onValueChange={setSelectedDealId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a deal from your Deal Room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No deal selected</SelectItem>
                {userDeals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.name} {deal.year && deal.make && deal.model && `- ${deal.year} ${deal.make} ${deal.model}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Attach a deal so your coach can review it before your session.
            </p>
          </div>
        )}

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
          onClick={handleContinueBooking}
          disabled={isSubmitting || isProcessingPayment || !date || !time || !sessionType || !phone || !email}
          className="w-full"
          size="lg"
        >
          {isSubmitting || isProcessingPayment ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isProcessingPayment ? "Opening Payment..." : "Submitting..."}
            </>
          ) : user ? (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {sessionType === "video" 
                ? "Pay Deposit ($99.80) & Schedule" 
                : sessionType === "phone" 
                  ? "Pay $99 & Schedule" 
                  : sessionType === "text" 
                    ? "Pay $29 & Schedule" 
                    : "Schedule & Pay"}
            </>
          ) : (
            "Continue to Sign In"
          )}
        </Button>

        {sessionType === "video" && user && (
          <p className="text-xs text-center text-muted-foreground">
            Full Concierge: 20% deposit now ($99.80), remaining 80% ($399.20) charged after service completion.
          </p>
        )}

        {!user && (
          <p className="text-xs text-center text-muted-foreground">
            You'll need to sign in or create an account to complete your booking. Your information will be saved.
          </p>
        )}
      </div>
    </div>
  );
}