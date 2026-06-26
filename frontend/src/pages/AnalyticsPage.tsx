import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageWrapper, FadeIn, StaggerContainer, StaggerItem } from '../components/ui/animations';

import { Loader2, TrendingUp, TrendingDown, Users, CreditCard, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';

const COLORS = ['#10b981', '#3B82F6', '#ef4444', '#f59e0b', '#8b5cf6'];

const AnalyticsPage: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded }) => {
  const { walletAddress, userRole } = useWallet();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [subscriberData, setSubscriberData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);

  useEffect(() => {
    fetchAllAnalytics();
  }, [period]);

  const fetchAllAnalytics = async () => {
    setLoading(true);
    const [revRes, subRes, payRes, overRes] = await Promise.all([
      api(`/analytics/revenue-chart?period=${period}`),
      api(`/analytics/subscriber-growth?period=${period}`),
      api(`/analytics/payment-breakdown?period=${period}`),
      api(`/merchant/analytics?period=${period}`),
    ]);

    if (revRes.ok) setRevenueData(revRes.data);
    if (subRes.ok) setSubscriberData(subRes.data);
    if (payRes.ok) setPaymentData(payRes.data);
    if (overRes.ok) setOverviewData(overRes.data);
    setLoading(false);
  };

  if (!walletAddress || userRole !== 'merchant') {
    return (
      <PageWrapper>
        <main className="pt-nav" style={{ paddingBottom: '64px' }}>
          <section className="container" style={{ marginTop: '40px' }}>
            <FadeIn>
              <Card className="flex flex-col items-center gap-4 text-center p-8 max-w-md mx-auto mt-20">
                <BarChart3 size={48} className="text-primary" />
                <h2 className="text-h3">Merchant Analytics</h2>
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  Register as a merchant to access detailed analytics and revenue insights.
                </p>
              </Card>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  const content = (
    <StaggerContainer>
      {!isEmbedded && (
        <div className="flex justify-between items-end" style={{ marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="text-h2">Analytics Dashboard</h2>
            <p className="text-body-lg" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>
              Deep dive into your recurring revenue, subscriber growth, and payment health.
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] border border-[var(--glass-border)] focus:ring-[var(--accent-cyan)] outline-none rounded-[10px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="border border-[var(--glass-border)] rounded-[10px] shadow-lg">
              <SelectItem value="day" className="cursor-pointer">Today</SelectItem>
              <SelectItem value="week" className="cursor-pointer">This Week</SelectItem>
              <SelectItem value="month" className="cursor-pointer">This Month</SelectItem>
              <SelectItem value="quarter" className="cursor-pointer">This Quarter</SelectItem>
              <SelectItem value="year" className="cursor-pointer">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      {isEmbedded && (
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-h3">Performance Analytics</h3>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] border border-[var(--glass-border)] focus:ring-[var(--accent-cyan)] outline-none rounded-[10px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="border border-[var(--glass-border)] rounded-[10px] shadow-lg">
              <SelectItem value="day" className="cursor-pointer">Today</SelectItem>
              <SelectItem value="week" className="cursor-pointer">This Week</SelectItem>
              <SelectItem value="month" className="cursor-pointer">This Month</SelectItem>
              <SelectItem value="quarter" className="cursor-pointer">This Quarter</SelectItem>
              <SelectItem value="year" className="cursor-pointer">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}


        {loading && !overviewData ? (
          <StaggerItem>
            <Card className="flex justify-center items-center" style={{ minHeight: '400px' }}>
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>Loading analytics...</p>
              </div>
            </Card>
          </StaggerItem>
        ) : (
          <>
            {/* KPI Cards Row */}
            <StaggerContainer style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <StaggerItem>
                <KPICard
                  label="Monthly Recurring Revenue"
                  value={overviewData ? `$${(overviewData.mrr / 10000000).toFixed(2)}` : '$0.00'}
                  icon={<TrendingUp size={20} />}
                  color="#10b981"
                  subtitle="USDC / month"
                />
              </StaggerItem>
              <StaggerItem>
                <KPICard
                  label="Gross Revenue"
                  value={overviewData ? `$${(overviewData.totalRevenue / 10000000).toFixed(2)}` : '$0.00'}
                  icon={<CreditCard size={20} />}
                  color="var(--primary)"
                  subtitle={`${period} period`}
                />
              </StaggerItem>
              <StaggerItem>
                <KPICard
                  label="Net Revenue"
                  value={overviewData ? `$${(overviewData.netRevenue / 10000000).toFixed(2)}` : '$0.00'}
                  icon={<TrendingUp size={20} />}
                  color="#10b981"
                  subtitle={overviewData?.totalRefunds > 0 ? `-$${(overviewData.totalRefunds / 10000000).toFixed(2)} refunded` : 'No refunds'}
                  subtitleColor={overviewData?.totalRefunds > 0 ? '#ef4444' : 'var(--on-surface-variant)'}
                />
              </StaggerItem>
              <StaggerItem>
                <KPICard
                  label="Active Subscribers"
                  value={overviewData?.activeSubscribers?.toString() || '0'}
                  icon={<Users size={20} />}
                  color="#3B82F6"
                  subtitle={overviewData ? `+${overviewData.newSubscribers} new` : ''}
                  subtitleColor="#10b981"
                />
              </StaggerItem>
              <StaggerItem>
                <KPICard
                  label="Churn Rate"
                  value={overviewData ? `${overviewData.churnRate}%` : '0%'}
                  icon={<TrendingDown size={20} />}
                  color={overviewData?.churnRate > 5 ? '#ef4444' : '#10b981'}
                  subtitle={overviewData ? `${overviewData.cancelledSubscriptions} cancelled` : ''}
                />
              </StaggerItem>
            </StaggerContainer>

            {/* Revenue Chart */}
            <StaggerItem>
              <Card style={{ marginBottom: '24px' }}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-center" style={{ marginBottom: '24px' }}>
                    <div>
                      <h3 className="text-h3" style={{ fontSize: '20px' }}>Revenue Over Time</h3>
                      <p className="text-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                        {revenueData?.granularity === 'hour' ? 'Hourly' : revenueData?.granularity === 'day' ? 'Daily' : revenueData?.granularity === 'week' ? 'Weekly' : 'Monthly'} revenue in USDC
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '320px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData?.data || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--on-surface-variant)', fontSize: 12 }} dy={10} />
                        <YAxis
                          axisLine={false} tickLine={false}
                          tick={{ fill: 'var(--on-surface-variant)', fontSize: 12 }}
                          tickFormatter={(val) => `$${(val / 10000000).toFixed(0)}`}
                          dx={-10}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px', color: 'var(--on-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
                          formatter={(value: any) => [`$${(Number(value) / 10000000).toFixed(2)}`, 'Revenue']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#revenueGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>

            {/* Two-column: Subscriber Growth + Payment Breakdown */}
            <StaggerContainer className="grid-12" style={{ gap: '24px', marginBottom: '24px' }}>
              {/* Subscriber Growth */}
              <StaggerItem style={{ gridColumn: 'span 7' }}>
                <Card>
                <CardContent className="p-6">
                  <h3 className="text-h3" style={{ fontSize: '20px', marginBottom: '20px' }}>Subscriber Growth</h3>
                  <div style={{ height: '280px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(subscriberData?.newSubscribers || []).map((item: any, i: number) => ({
                          ...item,
                          cancelled: subscriberData?.cancellations?.[i]?.count || 0,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--outline-variant)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--on-surface-variant)', fontSize: 11 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--on-surface-variant)', fontSize: 12 }} dx={-10} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px', color: 'var(--on-surface)' }}
                        />
                        <Bar dataKey="count" name="New Subscribers" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
                </Card>
              </StaggerItem>

              {/* Payment Breakdown Pie */}
              <StaggerItem style={{ gridColumn: 'span 5' }}>
                <Card>
                <CardContent className="p-6">
                  <h3 className="text-h3" style={{ fontSize: '20px', marginBottom: '20px' }}>Payment Health</h3>
                  <div style={{ height: '280px' }}>
                    {paymentData?.breakdown?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={paymentData.breakdown}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="45%"
                            outerRadius={90}
                            innerRadius={50}
                            paddingAngle={3}
                            label={(props: any) => `${props.status}: ${props.count}`}
                            labelLine={{ stroke: 'var(--on-surface-variant)' }}
                          >
                            {paymentData.breakdown.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px' }}
                            formatter={(value: any, name: any) => [value, name ? name.charAt(0).toUpperCase() + name.slice(1) : '']}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-body-md" style={{ color: 'var(--on-surface-variant)' }}>No payment data yet</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </StaggerItem>
            </StaggerContainer>

            {/* Top Plans */}
            {paymentData?.topPlans?.length > 0 && (
              <StaggerItem>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-h3" style={{ fontSize: '20px', marginBottom: '20px' }}>Top Plans by Revenue</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {paymentData.topPlans.map((plan: any, idx: number) => {
                      const maxRevenue = paymentData.topPlans[0]?.revenue || 1;
                      const barWidth = Math.max(10, (plan.revenue / maxRevenue) * 100);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ minWidth: '140px', fontWeight: 500, fontSize: '14px' }}>{plan.name}</div>
                          <div style={{ flex: 1, position: 'relative', height: '28px', borderRadius: '8px', backgroundColor: 'var(--surface-container-low, #f5f5f5)', overflow: 'hidden' }}>
                            <div
                              style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0,
                                width: `${barWidth}%`,
                                borderRadius: '8px',
                                background: `linear-gradient(90deg, ${COLORS[idx % COLORS.length]}33, ${COLORS[idx % COLORS.length]}22)`,
                                borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`,
                                transition: 'width 0.6s ease-out',
                              }}
                            />
                            <div style={{
                              position: 'relative', zIndex: 1, padding: '4px 12px',
                              fontSize: '13px', fontWeight: 500,
                              color: 'var(--on-surface)',
                            }}>
                              {plan.revenueFormatted} ({plan.paymentCount} payments)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              </StaggerItem>
            )}
          </>
        )}
    </StaggerContainer>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <PageWrapper>
    <main className="pt-nav" style={{ paddingBottom: '64px' }}>
      <section className="container" style={{ marginTop: '40px' }}>
        {content}
      </section>
    </main>
    </PageWrapper>
  );
};

// KPI Card Component
const KPICard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  subtitleColor?: string;
}> = ({ label, value, icon, color, subtitle, subtitleColor }) => (
  <Card style={{ transition: 'transform 0.2s, box-shadow 0.2s' }}>
    <CardContent className="p-5 flex flex-col justify-between" style={{ minHeight: '140px' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
        <span className="text-label-caps" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>{label}</span>
        <div style={{ color, opacity: 0.8 }}>{icon}</div>
      </div>
      <div>
        <div className="text-h2" style={{ fontSize: '28px', color, letterSpacing: '-0.02em' }}>{value}</div>
        {subtitle && (
          <div className="text-label-caps" style={{ marginTop: '6px', color: subtitleColor || 'var(--on-surface-variant)', fontSize: '11px' }}>
            {subtitle}
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default AnalyticsPage;
