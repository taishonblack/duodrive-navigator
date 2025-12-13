-- Add SMS notification preference column
ALTER TABLE public.notification_preferences 
ADD COLUMN sms_reminders boolean NOT NULL DEFAULT true;