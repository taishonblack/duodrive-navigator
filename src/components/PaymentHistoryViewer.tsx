import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import jsPDF from "jspdf";
import { 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  CalendarIcon,
  Download,
  FileText,
  Filter,
  X
} from "lucide-react";

interface Transaction {
  id: string;
  type: "payment" | "refund";
  amount: number;
  currency: string;
  status: string;
  description: string;
  customerEmail: string | null;
  created: number;
  metadata: Record<string, string>;
  paymentIntentId?: string;
}

const statusColors: Record<string, string> = {
  succeeded: "bg-success/10 text-success border-success/20",
  requires_payment_method: "bg-warning/10 text-warning border-warning/20",
  requires_confirmation: "bg-warning/10 text-warning border-warning/20",
  processing: "bg-info/10 text-info border-info/20",
  canceled: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
};

const statusIcons: Record<string, typeof CheckCircle> = {
  succeeded: CheckCircle,
  requires_payment_method: Clock,
  requires_confirmation: Clock,
  processing: Loader2,
  canceled: XCircle,
  failed: XCircle,
  pending: Clock,
};

const allStatuses = ["all", "succeeded", "processing", "failed", "canceled", "pending"];

export function PaymentHistoryViewer() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "payment" | "refund">("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const { toast } = useToast();

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("list-stripe-transactions", {
        body: { limit: 100 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        throw new Error(data.error || "Failed to fetch transactions");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payment history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Email search
      if (searchEmail && tx.customerEmail) {
        if (!tx.customerEmail.toLowerCase().includes(searchEmail.toLowerCase())) {
          return false;
        }
      } else if (searchEmail && !tx.customerEmail) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== "all" && tx.type !== typeFilter) {
        return false;
      }

      // Date range filter
      const txDate = new Date(tx.created * 1000);
      if (startDate && txDate < startDate) {
        return false;
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (txDate > endOfDay) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, searchEmail, statusFilter, typeFilter, startDate, endDate]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const clearFilters = () => {
    setSearchEmail("");
    setStatusFilter("all");
    setTypeFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = searchEmail || statusFilter !== "all" || typeFilter !== "all" || startDate || endDate;

  const exportToCSV = () => {
    const headers = ["ID", "Type", "Status", "Amount", "Currency", "Customer Email", "Description", "Date"];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.type,
      tx.status,
      (tx.amount / 100).toFixed(2),
      tx.currency.toUpperCase(),
      tx.customerEmail || "",
      tx.description,
      new Date(tx.created * 1000).toISOString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${filteredTransactions.length} transactions to CSV.`,
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(18);
    doc.text("Payment History Report", pageWidth / 2, 20, { align: "center" });

    // Date range
    doc.setFontSize(10);
    const dateRange = startDate || endDate
      ? `${startDate ? format(startDate, "MMM d, yyyy") : "Start"} - ${endDate ? format(endDate, "MMM d, yyyy") : "Present"}`
      : "All Time";
    doc.text(`Date Range: ${dateRange}`, pageWidth / 2, 28, { align: "center" });
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, pageWidth / 2, 34, { align: "center" });

    // Summary
    const totalPayments = filteredTransactions.filter((tx) => tx.type === "payment").reduce((sum, tx) => sum + tx.amount, 0);
    const totalRefunds = filteredTransactions.filter((tx) => tx.type === "refund").reduce((sum, tx) => sum + tx.amount, 0);

    doc.setFontSize(12);
    doc.text("Summary", 14, 48);
    doc.setFontSize(10);
    doc.text(`Total Transactions: ${filteredTransactions.length}`, 14, 56);
    doc.text(`Total Payments: $${(totalPayments / 100).toFixed(2)}`, 14, 62);
    doc.text(`Total Refunds: $${(totalRefunds / 100).toFixed(2)}`, 14, 68);
    doc.text(`Net Amount: $${((totalPayments - totalRefunds) / 100).toFixed(2)}`, 14, 74);

    // Table header
    let y = 88;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Date", 14, y);
    doc.text("Type", 45, y);
    doc.text("Status", 65, y);
    doc.text("Customer", 95, y);
    doc.text("Amount", 160, y);

    // Table rows
    doc.setFont("helvetica", "normal");
    y += 8;

    filteredTransactions.slice(0, 40).forEach((tx) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      const txDate = new Date(tx.created * 1000);
      doc.text(format(txDate, "MM/dd/yy"), 14, y);
      doc.text(tx.type.charAt(0).toUpperCase() + tx.type.slice(1), 45, y);
      doc.text(tx.status.replace(/_/g, " "), 65, y);
      doc.text((tx.customerEmail || "N/A").slice(0, 25), 95, y);
      doc.text(`${tx.type === "refund" ? "-" : ""}$${(tx.amount / 100).toFixed(2)}`, 160, y);
      y += 6;
    });

    if (filteredTransactions.length > 40) {
      doc.text(`... and ${filteredTransactions.length - 40} more transactions`, 14, y + 4);
    }

    doc.save(`payment-history-${format(new Date(), "yyyy-MM-dd")}.pdf`);

    toast({
      title: "Export Complete",
      description: `Exported ${Math.min(filteredTransactions.length, 40)} transactions to PDF.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filteredTransactions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredTransactions.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={fetchTransactions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Email Search */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Customer Email</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "all" ? "All Statuses" : status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "payment" | "refund")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "MMM d, yyyy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </span>
        {filteredTransactions.length > 0 && (
          <span>
            Net: {formatAmount(
              filteredTransactions.filter((tx) => tx.type === "payment").reduce((sum, tx) => sum + tx.amount, 0) -
              filteredTransactions.filter((tx) => tx.type === "refund").reduce((sum, tx) => sum + tx.amount, 0),
              "usd"
            )}
          </span>
        )}
      </div>

      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {transactions.length === 0 ? "No transactions found." : "No transactions match your filters."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((transaction) => {
            const StatusIcon = statusIcons[transaction.status] || AlertCircle;
            const isRefund = transaction.type === "refund";
            
            return (
              <Card key={transaction.id} className="overflow-hidden">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isRefund ? "bg-info/10" : "bg-success/10"
                      }`}>
                        {isRefund ? (
                          <ArrowDownLeft className="h-5 w-5 text-info" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">
                            {isRefund ? "Refund" : "Payment"}
                          </p>
                          <Badge className={statusColors[transaction.status] || statusColors.pending}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${
                              transaction.status === "processing" ? "animate-spin" : ""
                            }`} />
                            {transaction.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                        {transaction.customerEmail && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {transaction.customerEmail}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(transaction.created)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-semibold ${
                        isRefund ? "text-info" : "text-foreground"
                      }`}>
                        {isRefund ? "-" : "+"}{formatAmount(transaction.amount, transaction.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {transaction.id.slice(0, 20)}...
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
