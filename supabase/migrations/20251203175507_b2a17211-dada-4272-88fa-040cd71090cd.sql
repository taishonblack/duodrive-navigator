-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create deals table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Deal',
  
  -- Car details
  year TEXT,
  make TEXT,
  model TEXT,
  trim TEXT,
  mileage TEXT,
  vin TEXT,
  dealer_zip TEXT,
  
  -- Pricing
  asking_price TEXT,
  negotiated_price TEXT,
  down_payment TEXT,
  trade_in TEXT,
  apr TEXT,
  term TEXT DEFAULT '60',
  
  -- Fees
  doc_fee TEXT,
  dealer_fee TEXT,
  add_ons TEXT,
  taxes TEXT,
  registration TEXT,
  
  -- Buyer profile
  buyer_zip TEXT,
  monthly_income TEXT,
  credit_score TEXT,
  insurance TEXT,
  fuel_cost TEXT,
  maintenance TEXT,
  
  -- Score results (stored as JSONB)
  score_result JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deals"
ON public.deals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deals"
ON public.deals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deals"
ON public.deals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deals"
ON public.deals FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_deals_user_id ON public.deals(user_id);
CREATE INDEX idx_deals_created_at ON public.deals(created_at DESC);