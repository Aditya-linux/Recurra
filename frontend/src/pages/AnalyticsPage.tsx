import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { api } from '../utils/api';
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

  const fetchAllAnalytics = async () => {
    setLoading(true);
    const [revRes, subRes, payRes, overRes] = await Promise.all([
      api(`/analytics/revenue?period=${period}`),
      api(`/analytics/subscriptions?period=${period}`),
      api(`/analytics/payments?period=${period}`),
      api(`/analytics/overview`)
    ]);

    if (revRes.ok && revRes.data) setRevenueData(revRes.data.data);
    if (subRes.ok && subRes.data) setSubscriberData(subRes.data.data);
    if (payRes.ok && payRes.data) setPaymentData(payRes.data.data);
    if (overRes.ok && overRes.data) setOverviewData(overRes.data.data);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchAllAnalytics();
  }, [period]);

  if (!walletAddress || userRole !== 'merchant') {
    return (
      <PageWrapper>
        <main className="pt-nav min-h-screen bg-[#F5F5F5] text-black pb-16 font-sans">
          <section className="container mx-auto px-6 mt-10 max-w-6xl">
            <FadeIn>
              <div className="bg-white border border-black/5 rounded-3xl flex flex-col items-center gap-4 text-center p-8 max-w-md mx-auto mt-20 shadow-sm">
                <BarChart3 size={48} className="text-black" />
                <h2 className="text-2xl font-bold tracking-tight text-black">Merchant Analytics</h2>
                <p className="text-sm font-medium text-black/60">
                  Register as a merchant to access detailed analytics and revenue insights.
                </p>
              </div>
            </FadeIn>
          </section>
        </main>
      </PageWrapper>
    );
  }

  const content = (
    <StaggerContainer>
      {!isEmbedded && (
        <div className="flex justify-between items-end mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-black">Analytics Dashboard</h2>
            <p className="text-lg text-black/60 mt-2">
              Deep dive into your recurring revenue, subscriber growth, and payment health.
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] bg-white border border-black/10 text-black font-medium focus:ring-black outline-none rounded-2xl">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="border border-black/10 rounded-2xl shadow-sm bg-white text-black z-50">
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
          <h3 className="text-2xl font-bold tracking-tight text-black">Performance Analytics</h3>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] bg-white border border-black/10 text-black font-medium focus:ring-black outline-none rounded-2xl h-12">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="border border-black/10 rounded-2xl shadow-sm bg-white text-black z-50">
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
            <div className="bg-white border border-black/5 rounded-3xl shadow-sm flex justify-center items-center min-h-[400px]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-black" size={40} />
                <p className="text-sm font-medium text-black/60">Loading analytics...</p>
              </div>
            </div>
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
              <div className="bg-white border border-black/5 rounded-3xl shadow-sm mb-6">
                <div className="p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-black">Revenue Over Time</h3>
                      <p className="text-sm font-medium text-black/60 mt-1">
                        {revenueData?.granularity === 'hour' ? 'Hourly' : revenueData?.granularity === 'day' ? 'Daily' : revenueData?.granularity === 'week' ? 'Weekly' : 'Monthly'} revenue in USDC
                      </p>
                    </div>
                  </div>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData?.data || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#000000" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }} dy={10} />
                        <YAxis
                          axisLine={false} tickLine={false}
                          tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}
                          tickFormatter={(val) => `$${(val / 10000000).toFixed(0)}`}
                          dx={-10}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '16px', color: '#000000', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', fontWeight: 600, fontFamily: 'sans-serif' }}
                          formatter={(value: any) => [`$${(Number(value) / 10000000).toFixed(2)}`, 'Revenue']}
                        />
                        <Area type="monotone" dataKey="revenue" stroke="#000000" strokeWidth={3} fill="url(#revenueGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Two-column: Subscriber Growth + Payment Breakdown */}
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
              {/* Subscriber Growth */}
              <StaggerItem className="md:col-span-7">
                <div className="bg-white border border-black/5 rounded-3xl shadow-sm p-6 md:p-8 h-full">
                  <h3 className="text-xl font-bold tracking-tight text-black mb-6">Subscriber Growth</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(subscriberData?.newSubscribers || []).map((item: any, i: number) => ({
                          ...item,
                          cancelled: subscriberData?.cancellations?.[i]?.count || 0,
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 11, fontFamily: 'sans-serif', fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }} dx={-10} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '16px', color: '#000000', fontWeight: 600, fontFamily: 'sans-serif' }}
                        />
                        <Bar dataKey="count" name="New Subscribers" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, fontFamily: 'sans-serif' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </StaggerItem>

              {/* Payment Breakdown Pie */}
              <StaggerItem className="md:col-span-5">
                <div className="bg-white border border-black/5 rounded-3xl shadow-sm p-6 md:p-8 h-full">
                  <h3 className="text-xl font-bold tracking-tight text-black mb-6">Payment Health</h3>
                  <div className="h-[280px]">
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
                            labelLine={{ stroke: 'rgba(0,0,0,0.3)' }}
                          >
                            {paymentData.breakdown.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '16px', color: '#000000', fontWeight: 600, fontFamily: 'sans-serif' }}
                            formatter={(value: any, name: any) => [value, name ? name.charAt(0).toUpperCase() + name.slice(1) : '']}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-sm font-medium text-black/60">No payment data yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>

            {/* Top Plans */}
            {paymentData?.topPlans?.length > 0 && (
              <StaggerItem>
                <div className="bg-white border border-black/5 rounded-3xl shadow-sm p-6 md:p-8">
                  <h3 className="text-xl font-bold tracking-tight text-black mb-6">Top Plans by Revenue</h3>
                  <div className="flex flex-col gap-4">
                    {paymentData.topPlans.map((plan: any, idx: number) => {
                      const maxRevenue = paymentData.topPlans[0]?.revenue || 1;
                      const barWidth = Math.max(10, (plan.revenue / maxRevenue) * 100);
                      return (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="min-w-[140px] font-bold text-sm text-black">{plan.name}</div>
                          <div className="flex-1 relative h-8 rounded-xl bg-black/5 overflow-hidden">
                            <div
                              className="absolute left-0 top-0 bottom-0 rounded-xl"
                              style={{
                                width: `${barWidth}%`,
                                background: `linear-gradient(90deg, ${COLORS[idx % COLORS.length]}33, ${COLORS[idx % COLORS.length]}22)`,
                                borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`,
                                transition: 'width 0.6s ease-out',
                              }}
                            />
                            <div className="relative z-10 px-3 py-1.5 text-xs font-bold text-black">
                              {plan.revenueFormatted} ({plan.paymentCount} payments)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </StaggerItem>
            )}
            {/* Advanced Analytics: Cohorts & Forecast (Mockup) */}
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Cohort Analysis */}
              <StaggerItem>
                <div className="bg-white border border-black/5 rounded-3xl shadow-sm p-6 md:p-8 h-full">
                  <h3 className="text-xl font-bold tracking-tight text-black mb-6">Retention Cohorts</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr>
                          <th className="pb-3 text-black/60 font-bold">Cohort</th>
                          <th className="pb-3 text-black/60 font-bold">Users</th>
                          <th className="pb-3 text-black/60 font-bold">M1</th>
                          <th className="pb-3 text-black/60 font-bold">M2</th>
                          <th className="pb-3 text-black/60 font-bold">M3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { date: 'Jan 2026', users: 120, m1: '95%', m2: '82%', m3: '78%' },
                          { date: 'Feb 2026', users: 145, m1: '92%', m2: '79%', m3: '-' },
                          { date: 'Mar 2026', users: 180, m1: '96%', m2: '-', m3: '-' },
                        ].map((row, i) => (
                          <tr key={i} className="border-t border-black/5">
                            <td className="py-3 font-bold">{row.date}</td>
                            <td className="py-3">{row.users}</td>
                            <td className="py-3 text-emerald-600 font-medium">{row.m1}</td>
                            <td className="py-3 text-emerald-600 font-medium">{row.m2}</td>
                            <td className="py-3 text-emerald-600 font-medium">{row.m3}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </StaggerItem>

              {/* AI Forecast */}
              <StaggerItem>
                <div className="bg-white border border-black/5 rounded-3xl shadow-sm p-6 md:p-8 h-full bg-gradient-to-br from-white to-blue-50/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold tracking-tight text-black">AI Revenue Forecast</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">BETA</span>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-sm">
                      <div className="text-sm font-bold text-black/50 uppercase tracking-wider mb-1">Projected MRR (Next Month)</div>
                      <div className="text-2xl font-bold text-blue-600">$12,450.00</div>
                      <div className="text-xs font-medium text-emerald-500 mt-1">+14.2% expected growth</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-black/5 shadow-sm">
                      <div className="text-sm font-bold text-black/50 uppercase tracking-wider mb-1">Churn Risk Analysis</div>
                      <div className="text-lg font-bold text-black">12 users at high risk</div>
                      <div className="text-xs font-medium text-black/60 mt-1">Consider sending a discount campaign.</div>
                      <button className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 transition">Take Action &rarr;</button>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>
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
  <div className="bg-white border border-black/5 rounded-3xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between min-h-[140px]">
    <div className="flex justify-between items-center mb-4">
      <span className="text-[11px] font-bold uppercase tracking-wider text-black/50">{label}</span>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
    </div>
    <div>
      <div className="text-3xl font-bold tracking-tight text-black" style={{ color }}>{value}</div>
      {subtitle && (
        <div className="text-[11px] font-bold mt-1" style={{ color: subtitleColor || 'rgba(0,0,0,0.5)' }}>
          {subtitle}
        </div>
      )}
    </div>
  </div>
);

export default AnalyticsPage;
