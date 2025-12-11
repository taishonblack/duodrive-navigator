import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MessageSquare, ChevronDown, ChevronUp, Trash2, Download, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// Storage keys for resuming conversations
const CHAT_STORAGE_KEY = "duodrive_copilot_chat";
const CHAT_TIMESTAMP_KEY = "duodrive_copilot_chat_timestamp";
const RESUME_CONVERSATION_KEY = "duodrive_resume_conversation";

export function ChatTranscripts() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const mapped = (data || []).map(d => ({
        ...d,
        messages: d.messages as unknown as ChatMessage[],
      }));
      setConversations(mapped);
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setConversations(prev => prev.filter(c => c.id !== id));
      toast.success("Conversation deleted");
    } catch (e) {
      console.error("Failed to delete conversation:", e);
      toast.error("Failed to delete conversation");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const exportAsText = (conv: Conversation) => {
    const dateStr = format(new Date(conv.updated_at), "MMMM d, yyyy 'at' h:mm a");
    let content = `DuoDrive AI Copilot Conversation\n`;
    content += `Date: ${dateStr}\n`;
    content += `${"=".repeat(50)}\n\n`;

    conv.messages.forEach(msg => {
      const role = msg.role === "user" ? "You" : "AI Copilot";
      content += `[${role}]\n${msg.content}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `duodrive-chat-${format(new Date(conv.updated_at), "yyyy-MM-dd-HHmm")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript exported as text file");
  };

  const exportAsPdf = (conv: Conversation) => {
    const doc = new jsPDF();
    const dateStr = format(new Date(conv.updated_at), "MMMM d, yyyy 'at' h:mm a");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DuoDrive AI Copilot Conversation", margin, y);
    y += 10;

    // Date
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${dateStr}`, margin, y);
    y += 15;

    // Messages
    doc.setTextColor(0, 0, 0);
    conv.messages.forEach(msg => {
      const role = msg.role === "user" ? "You" : "AI Copilot";
      
      // Check if we need a new page
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = 20;
      }

      // Role label
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(msg.role === "user" ? 59 : 100, msg.role === "user" ? 130 : 100, msg.role === "user" ? 246 : 100);
      doc.text(role, margin, y);
      y += 6;

      // Message content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      
      const lines = doc.splitTextToSize(msg.content, maxWidth);
      lines.forEach((line: string) => {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 5;
      });
      
      y += 8;
    });

    doc.save(`duodrive-chat-${format(new Date(conv.updated_at), "yyyy-MM-dd-HHmm")}.pdf`);
    toast.success("Transcript exported as PDF");
  };

  const continueConversation = (conv: Conversation) => {
    // Store the conversation data to be picked up by the chat hook
    localStorage.setItem(RESUME_CONVERSATION_KEY, JSON.stringify({
      id: conv.id,
      messages: conv.messages,
    }));
    // Also update the main chat storage so it loads immediately
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conv.messages));
    localStorage.setItem(CHAT_TIMESTAMP_KEY, Date.now().toString());
    
    toast.success("Conversation loaded! Redirecting to Deal Room...");
    navigate("/deal-room");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground">No conversations yet</h3>
        <p className="text-muted-foreground mt-2">
          Your AI Copilot conversations will appear here once you start chatting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversations.map(conv => {
        const messageCount = conv.messages.filter(m => m.role === "user").length;
        const isExpanded = expandedId === conv.id;
        const previewMessage = conv.messages.find(m => m.role === "user")?.content || "No messages";

        return (
          <Card key={conv.id} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-muted/50 transition-colors py-4"
              onClick={() => toggleExpand(conv.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {format(new Date(conv.updated_at), "MMM d, yyyy 'at' h:mm a")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {messageCount} message{messageCount !== 1 ? "s" : ""}
                  </p>
                  {!isExpanded && (
                    <p className="text-sm text-muted-foreground mt-2 truncate">
                      {previewMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Continue Conversation Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      continueConversation(conv);
                    }}
                    title="Continue this conversation"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  
                  {/* Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => exportAsText(conv)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export as Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportAsPdf(conv)}>
                        <Download className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this conversation? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteConversation(conv.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="pt-0 pb-4">
                <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
                  <div className="space-y-4">
                    {conv.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border text-foreground"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {/* Action buttons when expanded */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => continueConversation(conv)}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Continue Conversation
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => exportAsText(conv)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export as Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportAsPdf(conv)}>
                        <Download className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
