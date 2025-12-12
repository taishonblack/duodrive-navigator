import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CoachAnalyticsProps {
  coachId: string;
}

interface RatingData {
  rating: number;
  feedback: string | null;
  created_at: string;
}

export function CoachAnalytics({ coachId }: CoachAnalyticsProps) {
  const [ratings, setRatings] = useState<RatingData[]>([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [coachId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch ratings
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("session_ratings")
        .select("rating, feedback, created_at")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });

      if (ratingsError) throw ratingsError;
      setRatings(ratingsData || []);

      // Fetch completed sessions count
      const { count, error: sessionsError } = await supabase
        .from("coach_chat_sessions")
        .select("*", { count: "exact", head: true })
        .eq("coach_id", coachId)
        .eq("status", "completed");

      if (sessionsError) throw sessionsError;
      setCompletedSessions(count || 0);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
    percentage: ratings.length > 0 
      ? (ratings.filter(r => r.rating === star).length / ratings.length) * 100 
      : 0,
  }));

  const recentFeedback = ratings
    .filter(r => r.feedback)
    .slice(0, 5);

  const positiveRatings = ratings.filter(r => r.rating >= 4).length;
  const negativeRatings = ratings.filter(r => r.rating <= 2).length;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
                <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {averageRating.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Avg Rating ({ratings.length} reviews)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <MessageSquare className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{completedSessions}</p>
                <p className="text-sm text-muted-foreground">Sessions Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {ratings.length > 0 ? Math.round((positiveRatings / ratings.length) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Satisfaction Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ratingDistribution.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-3">
              <span className="w-16 text-sm text-muted-foreground flex items-center gap-1">
                {star} <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              </span>
              <Progress value={percentage} className="flex-1 h-2" />
              <span className="w-10 text-sm text-muted-foreground text-right">
                {count}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Feedback Trends */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Feedback Trends</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              <ThumbsUp className="h-3 w-3 mr-1" />
              {positiveRatings} positive
            </Badge>
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
              <ThumbsDown className="h-3 w-3 mr-1" />
              {negativeRatings} negative
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No written feedback yet. Encourage customers to leave reviews!
            </p>
          ) : (
            <div className="space-y-4">
              {recentFeedback.map((r, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= r.rating
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">"{r.feedback}"</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
