import { useEffect, useState, useCallback, useRef } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, CalendarClock, Activity, AlertTriangle, ChevronDown, ChevronUp, Clock, Filter } from 'lucide-react';
import TodoList from '../components/TodoList';
import CalendarWidget from '../components/CalendarWidget';
import ManpowerWidget from '../components/ManpowerWidget';
import ActivityRegisterWidget from '../components/ActivityRegisterWidget';
import OutlookMailWidget from '../components/OutlookMailWidget';


export default function Dashboard() {
    const {} = useSubcontractor();
    const [subcontractorsData, setSubcontractorsData] = useState<any[]>([]);
    const [progressAlerts, setProgressAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAllAlerts, setShowAllAlerts] = useState(false);
    const [selectedDashboardSubcontractorId, setSelectedDashboardSubcontractorId] = useState<string | null>(null);
    const [showStarts, setShowStarts] = useState(true);
    const [showExpectedEnd, setShowExpectedEnd] = useState(false);
    const [showDeadlines, setShowDeadlines] = useState(true);
    const [showInProgressActivities, setShowInProgressActivities] = useState(false);
    const [showLateStarts, setShowLateStarts] = useState(true);
    const [timeframeDays, setTimeframeDays] = useState(7);
    const [inProgressActivities, setInProgressActivities] = useState<any[]>([]);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

    // Scroll preservation: keep the dashboard in the same spot after a status change
    const preserveScroll = (fn: () => void) => {
        const prevY = window.scrollY;
        const prevDocEl = document.documentElement.scrollTop;
        fn();
        requestAnimationFrame(() => {
            if (Math.abs(window.scrollY - prevY) > 4 || Math.abs(document.documentElement.scrollTop - prevDocEl) > 4) {
                window.scrollTo({ top: prevY, behavior: 'auto' });
            }
        });
    };



    const handleStatusChange = useCallback(async (taskId: string, newStatus: string) => {
        setUpdatingStatus(taskId);
        const { error } = await supabase
            .from('work_activities')
            .update({ status: newStatus })
            .eq('id', taskId);
        setUpdatingStatus(null);
        if (!error) {
            // Update local state in place (no full refetch — keeps the dashboard in place)
            preserveScroll(() => {
                setProgressAlerts(prev => {
                    // Drop alerts for the task: when the status becomes 'completed', the
                    // task is no longer in the .neq('status', 'completed') query, so we
                    // remove every alert keyed on this task id. When the status changes
                    // away from 'planned' or 'completed', the alert type may change too,
                    // so we re-derive what should be visible.
                    if (newStatus === 'completed') {
                        return prev.filter(a => a.task_id !== taskId);
                    }
                    return prev.map(a => {
                        if (a.task_id !== taskId) return a;
                        // Reclassify alerts as needed
                        if (a.type === 'late_start' || a.type === 'start') {
                            // If task is now in_progress, these alerts should disappear
                            if (newStatus === 'in_progress') return null as any;
                        }
                        // Update the status badge color via current_status
                        return { ...a, current_status: newStatus };
                    }).filter(Boolean);
                });

                // Sync inProgressActivities: add if becoming in_progress, remove otherwise
                setInProgressActivities(prev => {
                    if (newStatus === 'in_progress') {
                        // Find the original activity from inProgressActivities (if it was already in_progress)
                        // or fetch a fresh copy from the now-loaded data set
                        const existing = prev.find(a => a.id === taskId);
                        if (existing) {
                            return prev.map(a => a.id === taskId ? { ...a, status: newStatus } : a);
                        }
                        // Need to fetch the activity to add to the list. Use a lightweight fetch.
                        supabase.from('work_activities').select('*, subcontractors(company_name)').eq('id', taskId).maybeSingle()
                            .then(({ data }) => {
                                if (data) {
                                    setInProgressActivities(curr => [{ ...data, status: newStatus }, ...curr]);
                                }
                            });
                        return prev;
                    } else {
                        return prev.filter(a => a.id !== taskId);
                    }
                });
            });
        }
    }, []);

    const loadInProgressActivities = async () => {
        const { data, error } = await supabase
            .from('work_activities')
            .select('*, subcontractors(company_name)')
            .eq('status', 'in_progress');
        console.log('[Fremdrift] In-progress query result:', data?.length, 'items', data, 'error:', error);
        if (data) setInProgressActivities(data);
    };

    const loadGlobalDashboard = async () => {
        setLoading(true);

            const { data: subs } = await supabase.from('subcontractors').select('*');

            if (subs) {
                const formattedSubs = await Promise.all(subs.map(async (sub) => {
                    const { data: mp } = await supabase
                        .from('daily_manpower')
                        .select('workers_count')
                        .eq('subcontractor_id', sub.id)
                        .order('date', { ascending: false })
                        .limit(1);

                    const { data: cos } = await supabase
                        .from('change_orders')
                        .select('amount')
                        .eq('subcontractor_id', sub.id)
                        .eq('status', 'approved');

                    const approvedCOs = cos?.reduce((sum, co) => sum + Number(co.amount), 0) || 0;
                    const originalValue = Number(sub.original_contract_value || 0);
                    const currentValue = originalValue + approvedCOs;

                    return {
                        id: sub.id,
                        name: sub.company_name || 'Ukjent firma',
                        trade: sub.trade || 'Ukjent fag',
                        contact: sub.contact_person || 'Ingen satt',
                        email: sub.email || '',
                        manpowerToday: mp && mp[0] ? mp[0].workers_count : 0,
                        currentValue,
                    };
                }));

                setSubcontractorsData(formattedSubs);
            }

            const { data: tasks } = await supabase
                .from('work_activities')
                .select('*, subcontractors(company_name)')
                .neq('status', 'completed');

            if (tasks) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 90); // Fetch up to 90 days, filter at render

                const alerts: any[] = [];

                tasks.forEach(task => {
                    const subName = task.subcontractors?.company_name || 'Ukjent fag';
                    
                    if (task.start_date) {
                        const start = new Date(task.start_date);
                        start.setHours(0, 0, 0, 0);
                        if (start < today && task.status === 'planned') {
                            // Activity should have started but is still planned — late start alert
                            alerts.push({
                                id: `${task.id}-late-start`,
                                type: 'late_start',
                                task: task.name,
                                sub: subName,
                                subcontractor_id: task.subcontractor_id,
                                date: task.start_date,
                                days: Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24)),
                                task_id: task.id,
                                current_status: task.status,
                            });
                        } else if (start >= today && start <= nextWeek && task.status === 'planned') {
                            alerts.push({
                                id: `${task.id}-start`,
                                type: 'start',
                                task: task.name,
                                sub: subName,
                                subcontractor_id: task.subcontractor_id,
                                date: task.start_date,
                                days: Math.ceil((start.getTime() - today.getTime()) / (1000 * 3600 * 24)),
                                task_id: task.id,
                                current_status: task.status,
                            });
                        }
                    }

                    if (task.expected_end_date && task.status !== 'completed') {
                        const expected = new Date(task.expected_end_date);
                        if (expected >= today && expected <= nextWeek) {
                            alerts.push({
                                id: `${task.id}-expected`,
                                type: 'expected_end',
                                task: task.name,
                                sub: subName,
                                subcontractor_id: task.subcontractor_id,
                                date: task.expected_end_date,
                                days: Math.ceil((expected.getTime() - today.getTime()) / (1000 * 3600 * 24)),
                                task_id: task.id,
                                current_status: task.status,
                            });
                        }
                    }

                    if (task.deadline && task.status !== 'completed') {
                        const deadline = new Date(task.deadline);
                        if (deadline < today) {
                            alerts.push({
                                id: `${task.id}-overdue`,
                                type: 'overdue',
                                task: task.name,
                                sub: subName,
                                subcontractor_id: task.subcontractor_id,
                                date: task.deadline,
                                days: Math.floor((today.getTime() - deadline.getTime()) / (1000 * 3600 * 24)),
                                task_id: task.id,
                                current_status: task.status,
                            });
                        } else if (deadline <= nextWeek) {
                            alerts.push({
                                id: `${task.id}-deadline`,
                                type: 'deadline',
                                task: task.name,
                                sub: subName,
                                subcontractor_id: task.subcontractor_id,
                                date: task.deadline,
                                days: Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24)),
                                task_id: task.id,
                                current_status: task.status,
                            });
                        }
                    }
                });

                setProgressAlerts(alerts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            }

            setLoading(false);
    };

    useEffect(() => {
        loadGlobalDashboard();
    }, []);

    // Load in-progress activities independently
    useEffect(() => {
        loadInProgressActivities();
    }, []);

    if (loading) return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                <div className="bg-slate-200 rounded-3xl h-full"></div>
                <div className="bg-slate-200 rounded-3xl h-full"></div>
            </div>
            <div className="h-64 bg-slate-200 rounded-3xl"></div>
        </div>
    );

    const timeframeMs = timeframeDays * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const filteredAlerts = progressAlerts.filter(a => {
        if (!showStarts && a.type === 'start') return false;
        if (!showLateStarts && a.type === 'late_start') return false;
        if (!showExpectedEnd && a.type === 'expected_end') return false;
        if (!showDeadlines && (a.type === 'deadline' || a.type === 'overdue')) return false;
        // Timeframe filter: only show alerts within the selected timeframe
        const alertDateMs = new Date(a.date).getTime();
        // For overdue and late_start alerts, always show them (they're past). For others, check if within timeframe
        if (a.type === 'overdue' || a.type === 'late_start') return true;
        const diff = alertDateMs - nowMs;
        if (diff > timeframeMs) return false;
        return true;
    });

    const displayedAlerts = showAllAlerts ? filteredAlerts : filteredAlerts.slice(0, 9);

    const statusLabels: Record<string, string> = {
        planned: 'Planlagt',
        in_progress: 'Påbegynt',
        completed: 'Ferdig',
    };

    return (
        <div className="space-y-6 pl-4 md:pl-6 xl:pl-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Prosjektoversikt</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Ditt globale dashbord og integrasjoner</p>
                </div>
            </div>

                        {/* Top Widget Row: TodoList + Calendar, then ManpowerWidget + ActivityRegisterWidget below TodoList */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="flex flex-col gap-4">
                    {/* Personal Todo List — takes most of the height */}
                    <TodoList />

            {/* Subcontractor Selector - affects only ManpowerWidget and ActivityRegisterWidget */}
            <div className="px-4 mb-2">
                <div className="relative inline-block w-full max-w-md">
                    <div className="flex items-center w-full bg-slate-100 hover:bg-slate-200/80 transition-colors rounded-xl px-4 py-2 cursor-pointer border border-slate-200 relative">
                        <Filter className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0" />
                        <select
                            aria-label="Velg underentreprenør"
                            value={selectedDashboardSubcontractorId || ''}
                            onChange={(e) => setSelectedDashboardSubcontractorId(e.target.value || null)}
                            className="appearance-none bg-transparent outline-none font-bold text-slate-800 text-sm w-full pr-6 cursor-pointer"
                        >
                            <option value="">Alle underentreprenører</option>
                            {subcontractorsData.map((sub: any) => (
                                <option key={sub.id} value={sub.id}>
                                    {sub.name} ({sub.trade})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
                    </div>
                </div>
            </div>

                    {/* Row: ManpowerWidget (wider) + ActivityRegisterWidget (narrower) */}
                    <div className="grid grid-cols-5 gap-4">
                        <div className="col-span-2">
                            <ManpowerWidget selectedSubcontractorId={selectedDashboardSubcontractorId} />
                        </div>
                        <div className="col-span-3">
                            <ActivityRegisterWidget selectedSubcontractorId={selectedDashboardSubcontractorId} />
                        </div>
                    </div>
                </div>

                {/* Right column: Calendar */}
                <CalendarWidget />
            </div>

            {/* Fremdriftsvarsler Section — Full Width */}
            <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-primary-500 shrink-0" />
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-800">Fremdriftsvarsler</h2>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-0.5">{filteredAlerts.length} varsler</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={showStarts} onChange={(e) => setShowStarts(e.target.checked)}
                                className="w-3.5 h-3.5 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Oppstart</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={showLateStarts} onChange={(e) => setShowLateStarts(e.target.checked)}
                                className="w-3.5 h-3.5 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Senket start</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={showExpectedEnd} onChange={(e) => setShowExpectedEnd(e.target.checked)}
                                className="w-3.5 h-3.5 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Forv. ferdig</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={showDeadlines} onChange={(e) => setShowDeadlines(e.target.checked)}
                                className="w-3.5 h-3.5 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Frist</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={showInProgressActivities} onChange={(e) => setShowInProgressActivities(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-600 border-slate-300 rounded focus:ring-amber-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pågår</span>
                        </label>
                        <select
                            value={timeframeDays}
                            onChange={(e) => setTimeframeDays(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all shrink-0"
                        >
                            <option value={3}>3 dager</option>
                            <option value={7}>1 uke</option>
                            <option value={14}>2 uker</option>
                            <option value={30}>1 måned</option>
                            <option value={60}>2 måneder</option>
                            <option value={90}>3 måneder</option>
                        </select>
                    </div>
                </div>

                {/* Alerts grouped by subcontractor */}
                {(filteredAlerts.length === 0 && !(showInProgressActivities && inProgressActivities.length > 0)) ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <Activity className="w-12 h-12 mb-3 text-slate-200" />
                        <p className="font-medium text-sm">Alt er i rute. Ingen kommende frister eller oppstarter.</p>
                    </div>
                ) : (
                    <>
                        {/* Group alerts (and in-progress activities) by subcontractor — merged into one grid per sub */}
                        {(() => {
                            const grouped = new Map<string, { subName: string; alerts: any[] }>();
                            filteredAlerts.forEach(alert => {
                                const existing = grouped.get(alert.subcontractor_id);
                                if (existing) {
                                    existing.alerts.push(alert);
                                } else {
                                    grouped.set(alert.subcontractor_id, { subName: alert.sub, alerts: [alert] });
                                }
                            });
                            // Merge in-progress activities into the same per-subcontractor groups
                            if (showInProgressActivities) {
                                inProgressActivities.forEach(act => {
                                    const item = {
                                        id: `ip-${act.id}`,
                                        type: 'in_progress',
                                        task: act.name,
                                        sub: act.subcontractors?.company_name || 'Ukjent',
                                        subcontractor_id: act.subcontractor_id,
                                        date: act.start_date,
                                        days: 0,
                                        task_id: act.id,
                                        current_status: act.status || 'in_progress',
                                    };
                                    const existing = grouped.get(act.subcontractor_id);
                                    if (existing) {
                                        existing.alerts.push(item);
                                    } else {
                                        grouped.set(act.subcontractor_id, { subName: item.sub, alerts: [item] });
                                    }
                                });
                            }

                            // Sort groups by subcontractor name
                            const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[1].subName.localeCompare(b[1].subName));

                            return sortedGroups.map(([subId, group]) => (
                                <div key={subId} className="mb-4">
                                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2 px-1">
                                        {group.subName}
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                        {group.alerts.map(alert => (
                                            <div key={alert.id} className={`p-2 rounded-lg border flex gap-1.5 shadow-sm ${
                                                alert.type === 'overdue' ? 'bg-red-50 border-red-100' :
                                                alert.type === 'late_start' ? 'bg-orange-50 border-orange-100' :
                                                alert.type === 'deadline' ? 'bg-yellow-50 border-yellow-100' :
                                                alert.type === 'start' ? 'bg-blue-50 border-blue-100' :
                                                alert.type === 'in_progress' ? 'bg-amber-50 border-amber-100' :
                                                'bg-primary-50/50 border-primary-100'
                                            }`}>
                                                <div className="mt-0.5 shrink-0">
                                                    {alert.type === 'overdue' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
                                                     alert.type === 'late_start' ? <Clock className="w-3.5 h-3.5 text-orange-500" /> :
                                                     alert.type === 'deadline' ? <CalendarClock className="w-3.5 h-3.5 text-yellow-500" /> :
                                                     alert.type === 'in_progress' ? <Activity className="w-3.5 h-3.5 text-amber-500" /> :
                                                     <AlertCircle className="w-3.5 h-3.5 text-primary-500" />}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex justify-between items-start gap-1">
                                                        <h4 className={`font-bold text-[11px] truncate leading-tight ${
                                                            alert.type === 'overdue' ? 'text-red-900' :
                                                            alert.type === 'late_start' ? 'text-orange-900' :
                                                            alert.type === 'deadline' ? 'text-yellow-900' :
                                                            alert.type === 'in_progress' ? 'text-amber-900' : 'text-slate-800'
                                                        }`}>{alert.task}</h4>
                                                        <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded uppercase shrink-0 leading-none ${
                                                            alert.type === 'overdue' ? 'bg-red-200 text-red-800' :
                                                            alert.type === 'late_start' ? 'bg-orange-200 text-orange-800' :
                                                            alert.type === 'deadline' ? 'bg-yellow-200 text-yellow-800' :
                                                            alert.type === 'start' ? 'bg-blue-200 text-blue-800' :
                                                            alert.type === 'in_progress' ? 'bg-amber-200 text-amber-800' :
                                                            'bg-primary-200 text-primary-800'
                                                        }`}>
                                                            {alert.type === 'overdue' ? `${alert.days}d` :
                                                             alert.type === 'late_start' ? `${alert.days}d` :
                                                             alert.type === 'in_progress' ? 'PÅGÅR' :
                                                             alert.days === 0 ? 'I dag' :
                                                             `Om ${alert.days}d`}
                                                        </span>
                                                    </div>
                                                    <p className={`text-[9px] font-semibold mt-0.5 truncate ${
                                                        alert.type === 'overdue' ? 'text-red-700' :
                                                        alert.type === 'late_start' ? 'text-orange-700' :
                                                        alert.type === 'deadline' ? 'text-yellow-700' :
                                                        alert.type === 'in_progress' ? 'text-amber-600' : 'text-slate-600'
                                                    }`}>
                                                        {alert.type === 'start' ? 'Oppstart' :
                                                         alert.type === 'late_start' ? 'Oppstart' :
                                                         alert.type === 'in_progress' ? `Startet: ${alert.date ? new Date(alert.date).toLocaleDateString('no-NO') : ''}` :
                                                         `Frist: ${new Date(alert.date).toLocaleDateString('no-NO')}`}
                                                    </p>
                                                    {/* Status change dropdown */}
                                                    {alert.task_id && (
                                                        <select
                                                            value={alert.current_status || 'planned'}
                                                            disabled={updatingStatus === alert.task_id}
                                                            onChange={(e) => handleStatusChange(alert.task_id, e.target.value)}
                                                            className={`mt-1 w-full appearance-none outline-none cursor-pointer pl-1 pr-4 py-0.5 rounded text-[9px] font-bold uppercase border focus:ring-1 focus:ring-primary-500/50 disabled:opacity-50 disabled:cursor-wait ${
                                                                alert.current_status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                                alert.current_status === 'in_progress' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                'bg-slate-50 text-slate-600 border-slate-200'
                                                            }`}
                                                        >
                                                            <option value="planned">Planlagt</option>
                                                            <option value="in_progress">Påbegynt</option>
                                                            <option value="completed">Ferdig</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                        {(filteredAlerts.length > 9 || (showInProgressActivities && inProgressActivities.length > 0)) && (
                            <button
                                onClick={() => setShowAllAlerts(!showAllAlerts)}
                                className="w-full mt-3 py-2 text-xs font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl transition-colors flex items-center justify-center"
                            >
                                {showAllAlerts ? (
                                    <>Vis færre <ChevronUp className="w-4 h-4 ml-1" /></>
                                ) : (
                                    <>Vis alle ({filteredAlerts.length + (showInProgressActivities ? inProgressActivities.length : 0)}) <ChevronDown className="w-4 h-4 ml-1" /></>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Contact Mail Widget — Full Width */}
            <OutlookMailWidget />

        </div>
    );
}
