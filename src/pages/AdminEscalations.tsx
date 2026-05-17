import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Clock, ArrowLeft, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Escalation {
  id: string;
  term: string;
  user_message: string;
  context: string | null;
  conversation_id: string | null;
  user_id: string | null;
  status: string;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export default function AdminEscalations() {
  const navigate = useNavigate();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roles) {
        toast.error("Access denied. Admin only.");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await loadEscalations();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/");
    }
  };

  const loadEscalations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("unknown_term_escalations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEscalations((data as Escalation[]) || []);
    } catch (error) {
      console.error("Error loading escalations:", error);
      toast.error("Failed to load escalations");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: {
        status: string;
        resolution_notes: string | null;
        resolved_by?: string | null;
        resolved_at?: string | null;
      } = {
        status: newStatus,
        resolution_notes: resolutionNotes[id] || null,
      };

      if (newStatus === "resolved" || newStatus === "added_to_glossary") {
        updateData.resolved_by = user?.id;
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_by = null;
        updateData.resolved_at = null;
      }

      const { error } = await supabase
        .from("unknown_term_escalations")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast.success(`Escalation marked as ${newStatus}`);
      await loadEscalations();
    } catch (error) {
      console.error("Error updating escalation:", error);
      toast.error("Failed to update escalation");
    }
  };

  const deleteEscalation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this escalation?")) return;

    try {
      const { error } = await supabase
        .from("unknown_term_escalations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Escalation deleted");
      await loadEscalations();
    } catch (error) {
      console.error("Error deleting escalation:", error);
      toast.error("Failed to delete escalation");
    }
  };

  const filteredEscalations = escalations.filter(e => 
    statusFilter === "all" || e.status === statusFilter
  );

  const statusCounts = {
    all: escalations.length,
    pending: escalations.filter(e => e.status === "pending").length,
    reviewing: escalations.filter(e => e.status === "reviewing").length,
    resolved: escalations.filter(e => e.status === "resolved").length,
    added_to_glossary: escalations.filter(e => e.status === "added_to_glossary").length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "reviewing":
        return <AlertTriangle className="h-4 w-4 text-primary" />;
      case "resolved":
      case "added_to_glossary":
        return <CheckCircle className="h-4 w-4 text-accent" />;
      default:
        return null;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary";
      case "reviewing":
        return "outline";
      case "resolved":
      case "added_to_glossary":
        return "default";
      default:
        return "secondary";
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Quinn Escalations</h1>
              <p className="text-muted-foreground">
                Review unknown terms and requests that Quinn couldn't handle
              </p>
            </div>
          </div>
          <Button onClick={loadEscalations} variant="outline">
            Refresh
          </Button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "reviewing", label: "Reviewing" },
            { value: "resolved", label: "Resolved" },
            { value: "added_to_glossary", label: "Added to Glossary" },
          ].map(({ value, label }) => (
            <Button
              key={value}
              variant={statusFilter === value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(value)}
            >
              {label} ({statusCounts[value as keyof typeof statusCounts]})
            </Button>
          ))}
        </div>

        {/* Escalations List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading escalations...
          </div>
        ) : filteredEscalations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {statusFilter === "all" 
                  ? "No escalations yet. Quinn is handling everything!" 
                  : `No ${statusFilter} escalations.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEscalations.map((escalation) => (
              <Card key={escalation.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(escalation.status)}
                        <CardTitle className="text-lg font-mono">
                          "{escalation.term}"
                        </CardTitle>
                        <Badge variant={getStatusBadgeVariant(escalation.status)}>
                          {escalation.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription>
                        {format(new Date(escalation.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteEscalation(escalation.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* User Message */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      User Asked:
                    </p>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {escalation.user_message}
                    </p>
                  </div>

                  {/* Context */}
                  {escalation.context && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        Context:
                      </p>
                      <p className="text-sm bg-muted p-3 rounded-lg">
                        {escalation.context}
                      </p>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Resolution Notes:
                    </p>
                    <Textarea
                      placeholder="Add notes about how this was resolved..."
                      value={resolutionNotes[escalation.id] ?? escalation.resolution_notes ?? ""}
                      onChange={(e) => setResolutionNotes(prev => ({
                        ...prev,
                        [escalation.id]: e.target.value
                      }))}
                      className="text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Resolved Info */}
                  {escalation.resolved_at && (
                    <p className="text-xs text-muted-foreground">
                      Resolved on {format(new Date(escalation.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Select
                      value={escalation.status}
                      onValueChange={(value) => updateStatus(escalation.id, value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="added_to_glossary">Added to Glossary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
