-- Fix missing policies identified in security scan

-- 1. Allow coaches to delete their own integrations
CREATE POLICY "Coaches can delete their own integrations"
ON public.coach_integrations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM coaches c
  WHERE c.user_id = auth.uid() AND c.id = coach_integrations.coach_id
));

-- 2. Allow users to update their push subscriptions (needed for upsert)
CREATE POLICY "Users can update their own subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- 3. Allow customers to update their ratings (within reason)
CREATE POLICY "Customers can update their own ratings"
ON public.session_ratings FOR UPDATE
USING (auth.uid() = customer_id);

-- 4. Allow users to delete their notification preferences
CREATE POLICY "Users can delete their own preferences"
ON public.notification_preferences FOR DELETE
USING (auth.uid() = user_id);