-- Add payment status tracking to coaching_requests
ALTER TABLE public.coaching_requests 
ADD COLUMN payment_status text NOT NULL DEFAULT 'pending',
ADD COLUMN stripe_payment_intent_id text,
ADD COLUMN stripe_customer_id text,
ADD COLUMN deposit_paid_at timestamp with time zone,
ADD COLUMN remaining_charged_at timestamp with time zone;

-- Add constraint for valid payment statuses
ALTER TABLE public.coaching_requests
ADD CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'deposit_paid', 'fully_paid', 'failed', 'refunded'));