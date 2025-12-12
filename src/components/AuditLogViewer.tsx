import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, 
  RefreshCw, 
  Loader2, 
  Eye, 
  UserCheck, 
  MessageSquare, 
  Play,
  Square,
  FileText,
  Calendar,
  User,
  Filter
} from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  coach_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  user_agent: string | null;
  created_at: string;
  coaches?: { display_name: string } | null;
}

const actionIcons: Record<string, typeof Eye> = {
  view_pending_requests: Eye,
  view_request_details: FileText,
  claim_request: UserCheck,
  admin_assign: UserCheck,
  start_chat_session: Play,
  end_chat_session: Square,
  view_customer_data: User,
};

const actionLabels: Record<string, string> = {
  view_pending_requests: "Viewed Pending Requests",
  view_request_details: "Viewed Request Details",
  claim_request: "Claimed Request",
  admin_assign: "Admin Assigned Coach",
  start_chat_session: "Started Chat Session",
  end_chat_session: "Ended Chat Session",
  view_customer_data: "Accessed Customer Data",
};

const actionColors: Record<string, string> = {
  view_pending_requests: "bg-muted text-muted-foreground",
  view_request_details: "bg-info/10 text-info",
  claim_request: "bg-success/10 text-success",
  admin_assign: "bg-accent/20 text-accent-foreground",
  start_chat_session: "bg-primary/10 text-primary",
  end_chat_session: "bg-warning/10 text-warning",
  view_customer_data: "bg-destructive/10 text-destructive",
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, dateFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = (supabase.from("coach_audit_logs") as any)
        .select("*, coaches(display_name)")
        .order("created_at", { ascending: false })
        .limit(200);

      // Apply action filter
      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      // Apply date filter
      if (dateFilter !== "all") {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          default:
            startDate = new Date(0);
        }
        query = query.gte("created_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(search) ||
      log.resource_type.toLowerCase().includes(search) ||
      (log.coaches?.display_name || "").toLowerCase().includes(search) ||
      (log.resource_id || "").toLowerCase().includes(search)
    );
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <CardDescription>
              Track coach actions for compliance and security review
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={actionFilter === "admin_assign" ? "default" : "outline"}
            size="sm"
            onClick={() => setActionFilter(actionFilter === "admin_assign" ? "all" : "admin_assign")}
          >
            <UserCheck className="h-4 w-4 mr-1" />
            Admin Assignments
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {actionLabels[action] || action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{filteredLogs.length}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
          <div className="bg-accent/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent-foreground">
              {filteredLogs.filter(l => l.action === "admin_assign").length}
            </p>
            <p className="text-xs text-muted-foreground">Admin Assigns</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-success">
              {filteredLogs.filter(l => l.action === "claim_request").length}
            </p>
            <p className="text-xs text-muted-foreground">Claims</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">
              {filteredLogs.filter(l => l.action === "start_chat_session").length}
            </p>
            <p className="text-xs text-muted-foreground">Sessions Started</p>
          </div>
          <div className="bg-info/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-info">
              {new Set(filteredLogs.map(l => l.coach_id)).size}
            </p>
            <p className="text-xs text-muted-foreground">Active Coaches</p>
          </div>
        </div>

        {/* Log List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No audit logs found</p>
            <p className="text-sm mt-1">Coach actions will appear here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => {
              const Icon = actionIcons[log.action] || FileText;
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={`p-2 rounded-full ${actionColors[log.action] || "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {log.coaches?.display_name || "Unknown Coach"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {log.resource_type}
                      {log.resource_id && (
                        <span className="font-mono text-xs ml-1">
                          ({log.resource_id.slice(0, 8)}...)
                        </span>
                      )}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    <p>{format(new Date(log.created_at), "MMM d, yyyy")}</p>
                    <p>{format(new Date(log.created_at), "h:mm a")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
