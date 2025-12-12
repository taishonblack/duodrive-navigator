import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SessionRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  coachId: string;
  coachName?: string;
  coachPhotoUrl?: string;
  onRatingComplete?: () => void;
}

export function SessionRatingDialog({
  open,
  onOpenChange,
  sessionId,
  coachId,
  coachName = "Your Coach",
  coachPhotoUrl,
  onRatingComplete,
}: SessionRatingDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        description: "Click on the stars to rate your session.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("session_ratings").insert({
        chat_session_id: sessionId,
        customer_id: user.id,
        coach_id: coachId,
        rating,
        feedback: feedback.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Thank you for your feedback!",
        description: "Your rating helps us improve our coaching service.",
      });

      onRatingComplete?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Rating error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = (rating: number) => {
    const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
    return labels[rating] || "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Rate Your Session</DialogTitle>
          <DialogDescription className="text-center">
            How was your coaching experience?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Coach Info */}
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={coachPhotoUrl} alt={coachName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {coachName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <p className="font-medium text-foreground">{coachName}</p>
          </div>

          {/* Star Rating */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm font-medium text-primary h-5">
              {getRatingLabel(hoveredRating || rating)}
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Additional feedback (optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Tell us more about your experience..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {feedback.length}/500
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Rating"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}