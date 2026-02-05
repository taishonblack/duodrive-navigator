-- Drop coaching-related database functions first (they reference coaching tables)
DROP FUNCTION IF EXISTS public.get_masked_session_phone(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_coaching_request_safe(uuid);
DROP FUNCTION IF EXISTS public.admin_assign_coach_to_request(uuid, uuid);

-- Drop tables in dependency order (children before parents)

-- Tables that reference coach_chat_sessions
DROP TABLE IF EXISTS public.session_ratings CASCADE;
DROP TABLE IF EXISTS public.coach_chat_messages CASCADE;

-- Tables that reference coaching_requests
DROP TABLE IF EXISTS public.coach_chat_sessions CASCADE;
DROP TABLE IF EXISTS public.coaching_sessions CASCADE;
DROP TABLE IF EXISTS public.coach_customer_updates CASCADE;

-- Tables that reference coaches
DROP TABLE IF EXISTS public.coach_integrations CASCADE;
DROP TABLE IF EXISTS public.coach_oauth_tokens CASCADE;
DROP TABLE IF EXISTS public.coach_audit_logs CASCADE;

-- Main coaching tables
DROP TABLE IF EXISTS public.coaching_requests CASCADE;
DROP TABLE IF EXISTS public.coaches CASCADE;

-- Drop coaching-related enum types
DROP TYPE IF EXISTS public.coaching_tier CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;
DROP TYPE IF EXISTS public.session_type CASCADE;