import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
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

export function PaymentHistoryViewer() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("list-stripe-transactions", {
        body: { limit: 50 },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
        <Button variant="outline" size="sm" onClick={fetchTransactions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No transactions found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {transactions.map((transaction) => {
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
