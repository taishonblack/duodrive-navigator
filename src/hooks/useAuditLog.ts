import { supabase } from "@/integrations/supabase/client";

type AuditAction = 
  | "view_pending_requests"
  | "view_request_details"
  | "claim_request"
  | "start_chat_session"
  | "end_chat_session"
  | "view_customer_data";

interface AuditLogParams {
  coachId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const logAction = async ({
    coachId,
    action,
    resourceType,
    resourceId,
    details = {},
  }: AuditLogParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use type assertion since types file may not be updated yet
      const { error } = await (supabase.from("coach_audit_logs") as any).insert({
        coach_id: coachId,
        user_id: user.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error("Audit log error:", error);
      }
    } catch (err) {
      console.error("Failed to log audit action:", err);
    }
  };

  return { logAction };
}
