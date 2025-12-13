import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { 
  RefreshCw, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ArrowDownLeft,
  Percent,
  CreditCard
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
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))"];

export function RevenueAnalytics() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7" | "30" | "90">("30");
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
        description: error.message || "Failed to load analytics data",
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
    const daysAgo = parseInt(dateRange);
    const cutoffDate = subDays(new Date(), daysAgo);
    return transactions.filter((tx) => new Date(tx.created * 1000) >= cutoffDate);
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    const payments = filteredTransactions.filter((tx) => tx.type === "payment" && tx.status === "succeeded");
    const refunds = filteredTransactions.filter((tx) => tx.type === "refund");
    
    const totalRevenue = payments.reduce((sum, tx) => sum + tx.amount, 0);
    const totalRefunds = refunds.reduce((sum, tx) => sum + tx.amount, 0);
    const netRevenue = totalRevenue - totalRefunds;
    const refundRate = payments.length > 0 ? (refunds.length / payments.length) * 100 : 0;

    return {
      totalRevenue: totalRevenue / 100,
      totalRefunds: totalRefunds / 100,
      netRevenue: netRevenue / 100,
      refundRate: refundRate.toFixed(1),
      transactionCount: payments.length,
      refundCount: refunds.length,
    };
  }, [filteredTransactions]);

  const dailyRevenueData = useMemo(() => {
    const daysAgo = parseInt(dateRange);
    const dailyData: Record<string, { date: string; revenue: number; refunds: number }> = {};

    // Initialize all days
    for (let i = daysAgo; i >= 0; i--) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      dailyData[date] = { date, revenue: 0, refunds: 0 };
    }

    // Populate with transaction data
    filteredTransactions.forEach((tx) => {
      const date = format(new Date(tx.created * 1000), "yyyy-MM-dd");
      if (dailyData[date]) {
        if (tx.type === "payment" && tx.status === "succeeded") {
          dailyData[date].revenue += tx.amount / 100;
        } else if (tx.type === "refund") {
          dailyData[date].refunds += tx.amount / 100;
        }
      }
    });

    return Object.values(dailyData).map((d) => ({
      ...d,
      displayDate: format(new Date(d.date), "MMM d"),
    }));
  }, [filteredTransactions, dateRange]);

  const sessionTypeData = useMemo(() => {
    const sessionTypes: Record<string, number> = {
      "Quick Text": 0,
      "Live Phone": 0,
      "Full Concierge": 0,
      "Other": 0,
    };

    filteredTransactions
      .filter((tx) => tx.type === "payment" && tx.status === "succeeded")
      .forEach((tx) => {
        const sessionType = tx.metadata?.session_type;
        if (sessionType === "text") {
          sessionTypes["Quick Text"] += tx.amount / 100;
        } else if (sessionType === "phone") {
          sessionTypes["Live Phone"] += tx.amount / 100;
        } else if (sessionType === "video") {
          sessionTypes["Full Concierge"] += tx.amount / 100;
        } else {
          sessionTypes["Other"] += tx.amount / 100;
        }
      });

    return Object.entries(sessionTypes)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const statusBreakdown = useMemo(() => {
    const statuses: Record<string, number> = {};

    filteredTransactions
      .filter((tx) => tx.type === "payment")
      .forEach((tx) => {
        const status = tx.status.replace(/_/g, " ");
        statuses[status] = (statuses[status] || 0) + 1;
      });

    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">Revenue Analytics</h2>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as "7" | "30" | "90")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchTransactions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gross Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Refunds</p>
                <p className="text-2xl font-bold text-info">
                  ${stats.totalRefunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 bg-info/10 rounded-full flex items-center justify-center">
                <ArrowDownLeft className="h-5 w-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net Revenue</p>
                <p className="text-2xl font-bold text-foreground">
                  ${stats.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                {stats.netRevenue >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Refund Rate</p>
                <p className="text-2xl font-bold text-foreground">{stats.refundRate}%</p>
              </div>
              <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center">
                <Percent className="h-5 w-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRefunds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--success))"
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="refunds"
                  name="Refunds"
                  stroke="hsl(var(--info))"
                  fill="url(#colorRefunds)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Session Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {sessionTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sessionTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {sessionTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No session data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" name="Transactions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No status data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
