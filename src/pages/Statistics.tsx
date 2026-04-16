import { useState, useEffect, useMemo } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Calendar, DollarSign, Users, AlertCircle, CheckCircle2, TrendingUp, Presentation, Clock } from 'lucide-react';

type Period = '7d' | '30d' | '90d' | 'this_year' | 'all_time';

export default function Statistics() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [period, setPeriod] = useState<Period>('30d');
    const [loading, setLoading] = useState(true);

    // Data states
    const [manpower, setManpower] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [changeOrders, setChangeOrders] = useState<any[]>([]);
    const [rfis, setRfis] = useState<any[]>([]);
    const [progressPercent, setProgressPercent] = useState<number>(0);

    useEffect(() => {
        if (!selectedSubcontractorId) return;

        async function fetchStats() {
            setLoading(true);

            let startDate = new Date();
            const todayStr = startDate.toISOString().split('T')[0];

            if (period === '7d') startDate.setDate(startDate.getDate() - 7);
            else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
            else if (period === '90d') startDate.setDate(startDate.getDate() - 90);
            else if (period === 'this_year') startDate = new Date(startDate.getFullYear(), 0, 1);
            else startDate = new Date(2000, 0, 1); // all time

            const startDateStr = startDate.toISOString().split('T')[0];

            // Fetch manpower
            const { data: manpowerData } = await supabase
                .from('daily_manpower')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .gte('date', startDateStr)
                .lte('date', todayStr)
                .order('date', { ascending: true });

            // Fetch activities
            const { data: actData } = await supabase
                .from('work_activities')
                .select('*')
                .eq('is_active', true)
                .eq('subcontractor_id', selectedSubcontractorId);

            // Fetch change orders
            const { data: coData } = await supabase
                .from('change_orders')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .gte('date', startDateStr)
                .lte('date', todayStr);

            // Fetch RFIs
            const { data: rfiData } = await supabase
                .from('rfis')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .gte('date_submitted', startDateStr)
                .lte('date_submitted', todayStr);

            // Fetch Grid Data for Progress %
            const { data: gridRes } = await supabase
                .from('project_progress_grid')
                .select('grid_data')
                .eq('subcontractor_id', selectedSubcontractorId)
                .maybeSingle();
                
            let percentage = 0;
            if (gridRes && gridRes.grid_data) {
                const gData = gridRes.grid_data as any;
                const plans = gData.plans || [];
                const activePlan = plans.find((p: any) => p.id === gData.activePlanId) || plans[0];
                const cells = activePlan?.grid?.cells || {};
                const totalCells = Object.keys(cells).length;
                if (totalCells > 0) {
                    let completed = 0;
                    let inProgress = 0;
                    Object.values(cells).forEach((c: any) => {
                        if (c?.status === 'completed') completed++;
                        else if (c?.status === 'in_progress') inProgress++;
                    });
                    percentage = (completed + (inProgress * 0.5)) / totalCells;
                }
            }
            setProgressPercent(percentage);

            setManpower(manpowerData || []);
            setActivities(actData || []);
            setChangeOrders(coData || []);
            setRfis(rfiData || []);

            setLoading(false);
        }

        fetchStats();
    }, [selectedSubcontractorId, period]);

    // Derived Statistics
    const { totalBillable, totalContract, totalBillableHours, totalApprovedAmount, openRfis, closedRfis, eacHours, manpowerChartData, activityHoursData } = useMemo(() => {
        let totalBillable = 0;
        let totalContract = 0;
        let totalBillableHours = 0;

        // Group manpower by date for the chart
        const chartDataMap = new Map();
        
        // Group hours by activity
        const activityHoursMap = new Map();

        manpower.forEach(m => {
            const billable = m.billable_workers || 0;
            let contract = 0;
            if (m.contract_workers !== null && m.contract_workers !== undefined) {
                contract = m.contract_workers;
            } else {
                contract = m.workers_count || 0;
            }

            totalBillable += billable;
            totalContract += contract;
            
            // Add hours (only billable hours now)
            totalBillableHours += m.hours_billable || 0;

            const dateLabel = new Date(m.date).toLocaleDateString('no-NO', { month: 'short', day: 'numeric' });
            if (!chartDataMap.has(dateLabel)) {
                chartDataMap.set(dateLabel, { date: dateLabel, 'Regningsarbeidere': 0, 'Kontraktsarbeidere': 0, 'Regningstimer': 0 });
            }
            const existing = chartDataMap.get(dateLabel);
            existing['Regningsarbeidere'] += billable;
            existing['Kontraktsarbeidere'] += contract;
            existing['Regningstimer'] += m.hours_billable || 0;
            
            // Track hours by activity
            if (m.activity_id) {
                const activity = activities.find(a => a.id === m.activity_id);
                if (activity) {
                    if (!activityHoursMap.has(activity.name)) {
                        activityHoursMap.set(activity.name, { 
                            name: activity.name, 
                            change_order_number: activity.change_order_number,
                            hours: 0, 
                            workers: 0 
                        });
                    }
                    const actData = activityHoursMap.get(activity.name);
                    actData.hours += m.hours_billable || 0;
                    actData.workers += billable + contract;
                }
            }
        });

        const totalApprovedAmount = changeOrders
            .filter(co => co.status === 'approved')
            .reduce((sum, co) => sum + (Number(co.amount) || 0), 0);

        const openRfis = rfis.filter(r => r.status === 'open').length;
        const closedRfis = rfis.filter(r => r.status === 'closed').length;

        return {
            totalBillable,
            totalContract,
            totalBillableHours,
            totalApprovedAmount,
            openRfis,
            closedRfis,
            eacHours: progressPercent > 0 ? Math.round(totalBillableHours / progressPercent) : 0,
            manpowerChartData: Array.from(chartDataMap.values()),
            activityHoursData: Array.from(activityHoursMap.values())
        };
    }, [manpower, changeOrders, rfis, activities, progressPercent]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('no-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(amount);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <Presentation className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Velg en underentreprenør for å se statistikk for perioden.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
                        <TrendingUp className="w-7 h-7 mr-3 text-primary-600" />
                        Statistikk og Oversikt
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Oppsummerer data for prosjektperioden</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl self-stretch sm:self-auto overflow-x-auto">
                    {[
                        { id: '7d', label: '7 dager' },
                        { id: '30d', label: '30 dager' },
                        { id: '90d', label: '3 mnd' },
                        { id: 'this_year', label: 'I år' },
                        { id: 'all_time', label: 'Alt' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => setPeriod(p.id as Period)}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all whitespace-nowrap ${period === p.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Users className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-3 text-amber-600 mb-2">
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-600 truncate">Regningstimer</h3>
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-4">{totalBillableHours} <span className="text-base font-bold text-slate-400">timer</span></p>
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Users className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-3 text-primary-600 mb-2">
                                <div className="p-2 bg-primary-50 rounded-lg">
                                    <Users className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-600 truncate">Arbeidere</h3>
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-4">{totalBillable} <span className="text-base font-bold text-slate-400">pers.</span></p>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 border border-slate-700 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <TrendingUp className="w-24 h-24 text-white" />
                            </div>
                            <div className="flex items-center gap-3 text-emerald-400 mb-2">
                                <div className="p-2 bg-slate-800 border border-slate-700 rounded-lg">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-400 truncate">EAC (Prognose)</h3>
                            </div>
                            <p className="text-3xl font-black text-emerald-400 mt-4">
                                {eacHours > 0 ? eacHours : '-'} <span className="text-base font-bold text-slate-500">timer totalt</span>
                            </p>
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <DollarSign className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-3 text-emerald-600 mb-2">
                                <div className="p-2 bg-emerald-50 rounded-lg">
                                    <DollarSign className="w-5 h-5" />
                                </div>
                                <h3 className="font-bold text-slate-600 truncate">Endringer</h3>
                            </div>
                            <p className="text-3xl font-black text-slate-900 mt-4">{formatCurrency(totalApprovedAmount).replace('kr', '')}</p>
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm relative overflow-hidden flex divide-x divide-slate-100">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 text-rose-500 mb-2"><AlertCircle className="w-4 h-4" /> <span className="font-bold text-[11px] uppercase tracking-wider">Åpne RFI</span></div>
                                <p className="text-2xl font-black text-slate-900">{openRfis}</p>
                            </div>
                            <div className="flex-1 pl-4">
                                <div className="flex items-center gap-2 text-emerald-500 mb-2"><CheckCircle2 className="w-4 h-4" /> <span className="font-bold text-[11px] uppercase tracking-wider">Lukket</span></div>
                                <p className="text-2xl font-black text-slate-900">{closedRfis}</p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Manpower Trend */}
                        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="font-extrabold text-slate-800 mb-6 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-primary-500" />
                                Regningstimer over tid
                            </h3>
                            {manpowerChartData.length > 0 ? (
                                <div className="h-72 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={manpowerChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="Regningstimer" fill="#f59e0b" radius={[4, 4, 4, 4]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-slate-400 font-medium">
                                    Ingen timedata i valgt periode
                                </div>
                            )}
                        </div>

                        {/* Summary Mix */}
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 flex flex-col justify-center">
                            <h3 className="font-extrabold text-slate-800 mb-6 flex items-center text-center justify-center">
                                <Calendar className="w-5 h-5 mr-2 text-primary-500" />
                                Arbeidsfordeling
                            </h3>
                            {totalBillable > 0 || totalContract > 0 ? (
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Kontrakt', value: totalContract },
                                                    { name: 'Regning', value: totalBillable }
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                <Cell fill="#1ca566" />
                                                <Cell fill="#f59e0b" />
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-64 flex items-center justify-center text-slate-400 font-medium">
                                    Ingen data
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Activity Hours Table */}
                    {activityHoursData.length > 0 && (
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
                            <h3 className="font-extrabold text-slate-800 mb-6 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-primary-500" />
                                Timer per aktivitet
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="text-left py-3 px-4 font-bold text-slate-600">Aktivitet</th>
                                            <th className="text-right py-3 px-4 font-bold text-slate-600">Timer</th>
                                            <th className="text-right py-3 px-4 font-bold text-slate-600">Arbeidere</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                         {activityHoursData.sort((a, b) => b.hours - a.hours).map((activity, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="py-3 px-4 font-medium text-slate-800">
                                                    {activity.name}
                                                    {activity.change_order_number && (
                                                        <span className="ml-2 text-xs text-blue-600 font-medium">(EM: {activity.change_order_number})</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-primary-600">{activity.hours}t</td>
                                                <td className="py-3 px-4 text-right text-slate-600">{activity.workers}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}