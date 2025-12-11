import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { MessageSquare, ChevronDown, ChevronUp, Trash2, Download, FileText, Play, Search, Pencil, X, Check, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  title: string | null;
  notes: string | null;
}

// Storage keys for resuming conversations
const CHAT_STORAGE_KEY = "duodrive_copilot_chat";
const CHAT_TIMESTAMP_KEY = "duodrive_copilot_chat_timestamp";
const RESUME_CONVERSATION_KEY = "duodrive_resume_conversation";

export function ChatTranscripts() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState("");
  const [tempNotes, setTempNotes] = useState("");
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

  const updateTitle = async (id: string, title: string) => {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ title: title.trim() || null })
        .eq("id", id);

      if (error) throw error;
      
      setConversations(prev => prev.map(c => 
        c.id === id ? { ...c, title: title.trim() || null } : c
      ));
      toast.success("Title updated");
    } catch (e) {
      console.error("Failed to update title:", e);
      toast.error("Failed to update title");
    } finally {
      setEditingTitleId(null);
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ notes: notes.trim() || null })
        .eq("id", id);

      if (error) throw error;
      
      setConversations(prev => prev.map(c => 
        c.id === id ? { ...c, notes: notes.trim() || null } : c
      ));
      toast.success("Notes saved");
    } catch (e) {
      console.error("Failed to update notes:", e);
      toast.error("Failed to save notes");
    } finally {
      setEditingNotesId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setEditingTitleId(null);
    setEditingNotesId(null);
  };

  const startEditingTitle = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(conv.id);
    setTempTitle(conv.title || "");
  };

  const startEditingNotes = (conv: Conversation) => {
    setEditingNotesId(conv.id);
    setTempNotes(conv.notes || "");
  };

  const exportAsText = (conv: Conversation) => {
    const dateStr = format(new Date(conv.updated_at), "MMMM d, yyyy 'at' h:mm a");
    const title = conv.title || "Untitled Conversation";
    let content = `DuoDrive AI Copilot Conversation\n`;
    content += `Title: ${title}\n`;
    content += `Date: ${dateStr}\n`;
    if (conv.notes) {
      content += `Notes: ${conv.notes}\n`;
    }
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
    const title = conv.title || "Untitled Conversation";
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 10;

    // Date
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Date: ${dateStr}`, margin, y);
    y += 8;

    // Notes if present
    if (conv.notes) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80, 80, 80);
      const notesLines = doc.splitTextToSize(`Notes: ${conv.notes}`, maxWidth);
      notesLines.forEach((line: string) => {
        doc.text(line, margin, y);
        y += 5;
      });
      y += 5;
    }

    y += 5;

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

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    
    // Search in title
    if (conv.title?.toLowerCase().includes(query)) return true;
    
    // Search in notes
    if (conv.notes?.toLowerCase().includes(query)) return true;
    
    // Search in message content
    return conv.messages.some(msg => 
      msg.content.toLowerCase().includes(query)
    );
  });

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
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {filteredConversations.length === 0 ? (
        <div className="text-center py-8">
          <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No conversations match your search.</p>
        </div>
      ) : (
        filteredConversations.map(conv => {
          const messageCount = conv.messages.filter(m => m.role === "user").length;
          const isExpanded = expandedId === conv.id;
          const previewMessage = conv.messages.find(m => m.role === "user")?.content || "No messages";
          const displayTitle = conv.title || format(new Date(conv.updated_at), "MMM d, yyyy 'at' h:mm a");

          return (
            <Card key={conv.id} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-muted/50 transition-colors py-4"
                onClick={() => toggleExpand(conv.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title with edit functionality */}
                    {editingTitleId === conv.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={tempTitle}
                          onChange={(e) => setTempTitle(e.target.value)}
                          placeholder="Enter a title..."
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateTitle(conv.id, tempTitle);
                            } else if (e.key === "Escape") {
                              setEditingTitleId(null);
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary"
                          onClick={() => updateTitle(conv.id, tempTitle)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setEditingTitleId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="truncate">{displayTitle}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0"
                          onClick={(e) => startEditingTitle(conv, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </CardTitle>
                    )}
                    
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {messageCount} message{messageCount !== 1 ? "s" : ""}
                      </p>
                      {!conv.title && (
                        <p className="text-xs text-muted-foreground">
                          • {format(new Date(conv.updated_at), "MMM d, yyyy")}
                        </p>
                      )}
                      {conv.notes && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <StickyNote className="h-3 w-3" />
                          Has notes
                        </span>
                      )}
                    </div>
                    
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
                <CardContent className="pt-0 pb-4 space-y-4">
                  {/* Notes Section */}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <StickyNote className="h-3 w-3" />
                        Notes
                      </label>
                      {editingNotesId !== conv.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => startEditingNotes(conv)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {editingNotesId === conv.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Add notes about this conversation..."
                          className="min-h-[80px] text-sm"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateNotes(conv.id, tempNotes)}
                          >
                            Save Notes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingNotesId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">
                        {conv.notes || <span className="text-muted-foreground italic">No notes added</span>}
                      </p>
                    )}
                  </div>

                  {/* Messages */}
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
                  <div className="flex gap-2">
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
        })
      )}
    </div>
  );
}
