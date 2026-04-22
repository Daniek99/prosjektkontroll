import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Building2, Users, DollarSign, ChevronRight, AlertCircle, CalendarClock, Activity, AlertTriangle, Plus, X, Calendar as CalendarIcon } from 'lucide-react';
import TodoList from '../components/TodoList';
import SubcontractorTodoList from '../components/SubcontractorTodoList';
import CalendarWidget from '../components/CalendarWidget';
import { Link } from 'react-router-dom';



export default function Dashboard() {
    const { setSelectedSubcontractorId } = useSubcontractor();
    const [subcontractorsData, setSubcontractorsData] = useState<any[]>([]);
    const [progressAlerts, setProgressAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [newActivity, setNewActivity] = useState({ name: '', subcontractor_id: '', start_date: '', expected_end_date: '', deadline: '' });
    const [creating, setCreating] = useState(false);

    const loadGlobalDashboard = async () => {
        setLoading(true);

            // 1. Fetch all subcontractors
            const { data: subs } = await supabase.from('subcontractors').select('*');

            if (subs) {
                const formattedSubs = await Promise.all(subs.map(async (sub) => {
                    // Fetch latest manpower instead of strictly today (in case of log lag/delay)
                    const { data: mp } = await supabase
                        .from('daily_manpower')
                        .select('workers_count')
                        .eq('subcontractor_id', sub.id)
                        .order('date', { ascending: false })
                        .limit(1);

                    // Fetch approved COs
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
                        name: sub.name,
                        trade: sub.trade_category,
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
                .select('*, subcontractors(name)')
                .neq('status', 'completed');

            if (tasks) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);

                const alerts: any[] = [];

                tasks.forEach(task => {
                    const subName = task.subcontractors?.name || 'Ukjent fag';
                    
                    if (task.start_date) {
                        const start = new Date(task.start_date);
                        if (start >= today && start <= nextWeek && task.status === 'planned') {
                            alerts.push({
                                id: `${task.id}-start`,
                                type: 'start',
                                task: task.name,
                                sub: subName,
                                date: task.start_date,
                                days: Math.ceil((start.getTime() - today.getTime()) / (1000 * 3600 * 24))
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
                                date: task.expected_end_date,
                                days: Math.ceil((expected.getTime() - today.getTime()) / (1000 * 3600 * 24))
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
                                date: task.deadline,
                                days: Math.floor((today.getTime() - deadline.getTime()) / (1000 * 3600 * 24))
                            });
                        } else if (deadline <= nextWeek) {
                            alerts.push({
                                id: `${task.id}-deadline`,
                                type: 'deadline',
                                task: task.name,
                                sub: subName,
                                date: task.deadline,
                                days: Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24))
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

    const handleCreateActivity = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newActivity.name || !newActivity.subcontractor_id) return;
        setCreating(true);
        const { error } = await supabase.from('work_activities').insert([{
            name: newActivity.name,
            subcontractor_id: newActivity.subcontractor_id,
            start_date: newActivity.start_date || null,
            expected_end_date: newActivity.expected_end_date || null,
            deadline: newActivity.deadline || null
        }]);
        setCreating(false);
        if (!error) {
            setShowActivityModal(false);
            setNewActivity({ name: '', subcontractor_id: '', start_date: '', expected_end_date: '', deadline: '' });
            loadGlobalDashboard();
        } else {
            alert('Kunne ikke opprette aktivitet. Sjekk skjemaet og prøv igjen.');
        }
    };

    if (loading) return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                <div className="bg-slate-200 rounded-3xl h-full"></div>
                <div className="bg-slate-200 rounded-3xl h-full"></div>
            </div>
            <div className="h-64 bg-slate-200 rounded-3xl"></div>
        </div>
    );

    return (
        <div className="space-y-6 pl-4 md:pl-6 xl:pl-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Prosjektoversikt</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Ditt globale dashbord og integrasjoner</p>
                </div>
            </div>

            {/* Top Widget Row: Tasks and Calendar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-auto min-h-[450px]">
                {/* Tasks Widget */}
                <div className="h-full flex flex-col gap-6">
                    <TodoList />
                    <SubcontractorTodoList />
                </div>

                {/* Mocked Teams/Outlook Calendar Widget */}
                <div className="h-full flex flex-col gap-6">
                    <CalendarWidget />
                    
                    {/* Progress Alerts Widget */}
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col min-h-[300px]">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800 flex items-center">
                                    <Activity className="w-5 h-5 mr-2 text-primary-500" />
                                    Fremdriftsvarsler
                                </h2>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-0.5">{progressAlerts.length} varsler</span>
                            </div>
                            <button onClick={() => setShowActivityModal(true)} className="p-2 bg-primary-50 text-primary-600 rounded-lg focus:outline-none hover:bg-primary-100 hover:text-primary-700 transition-colors group flex items-center" title="Opprett ny aktivitet">
                                <Plus className="w-4 h-4 mr-1.5" />
                                <span className="text-xs font-bold">Ny Aktivitet</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
                            {progressAlerts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                    <Activity className="w-12 h-12 mb-3 text-slate-200" />
                                    <p className="font-medium text-sm">Alt er i rute. Ingen kommende frister eller oppstarter de neste 7 dagene.</p>
                                </div>
                            ) : (
                                progressAlerts.map(alert => (
                                    <div key={alert.id} className={`p-4 rounded-xl border flex gap-3 shadow-sm ${
                                        alert.type === 'overdue' ? 'bg-red-50 border-red-100' :
                                        alert.type === 'deadline' ? 'bg-yellow-50 border-yellow-100' :
                                        alert.type === 'start' ? 'bg-blue-50 border-blue-100' :
                                        'bg-primary-50/50 border-primary-100'
                                    }`}>
                                        <div className="mt-0.5 shrink-0">
                                            {alert.type === 'overdue' ? <AlertTriangle className="w-5 h-5 text-red-500" /> :
                                             alert.type === 'deadline' ? <CalendarClock className="w-5 h-5 text-yellow-500" /> :
                                             <AlertCircle className="w-5 h-5 text-primary-500" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className={`font-bold text-sm truncate ${
                                                    alert.type === 'overdue' ? 'text-red-900' :
                                                    alert.type === 'deadline' ? 'text-yellow-900' : 'text-slate-800'
                                                }`}>{alert.task}</h4>
                                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                                    alert.type === 'overdue' ? 'bg-red-200 text-red-800' :
                                                    alert.type === 'deadline' ? 'bg-yellow-200 text-yellow-800' :
                                                    alert.type === 'start' ? 'bg-blue-200 text-blue-800' :
                                                    'bg-primary-200 text-primary-800'
                                                }`}>
                                                    {alert.type === 'overdue' ? `${alert.days} dager over` :
                                                     alert.days === 0 ? 'I dag' :
                                                     `Om ${alert.days} dager`}
                                                </span>
                                            </div>
                                            <p className={`text-xs font-semibold mt-0.5 truncate ${
                                                    alert.type === 'overdue' ? 'text-red-700' :
                                                    alert.type === 'deadline' ? 'text-yellow-700' : 'text-slate-600'
                                            }`}>{alert.sub}</p>
                                            <p className={`text-xs mt-1 font-medium ${
                                                    alert.type === 'overdue' ? 'text-red-600' :
                                                    alert.type === 'deadline' ? 'text-yellow-700' : 'text-slate-500'
                                            }`}>
                                                {alert.type === 'start' ? 'Planlagt oppstart' :
                                                 alert.type === 'expected_end' ? 'Forventet ferdig' : 'Frist'}: {new Date(alert.date).toLocaleDateString('no-NO')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Horizontal Subcontractor Summary */}
            <div className="pt-4">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-xl font-extrabold text-slate-800 flex items-center">
                        <Users className="w-6 h-6 mr-2 text-primary-500" />
                        Underentreprenører
                    </h2>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{subcontractorsData.length} aktive</span>
                </div>

                {/* Horizontally scrolling container */}
                <div className="flex overflow-x-auto pb-6 -mx-4 px-4 gap-4 snap-x snap-mandatory scrollbar-hide">
                    {subcontractorsData.map(sub => (
                        <div key={sub.id} className="snap-start shrink-0 w-[80vw] sm:w-[calc(50%-0.5rem)] bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all hover:border-primary-300 group flex flex-col">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h3 className="font-extrabold text-xl text-slate-900 group-hover:text-primary-700 transition-colors truncate w-full pr-4">{sub.name}</h3>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600 mt-2">
                                        {sub.trade}
                                    </span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors shrink-0">
                                    <Building2 className="w-6 h-6" />
                                </div>
                            </div>

                            <div className="mb-6 pb-4 border-b border-slate-100">
                                <p className="text-sm font-medium text-slate-500 flex items-center mt-3">
                                    <Users className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                                    Kontakt: <strong className="ml-1 text-slate-700 truncate">{sub.contact}</strong>
                                </p>
                                {sub.email && (
                                    <p className="text-sm font-medium text-slate-500 flex items-center mt-1.5 truncate">
                                        <span className="w-4 h-4 mr-2 text-slate-400 font-serif font-bold text-center leading-none shrink-0">@</span>
                                        <span className="truncate">{sub.email}</span>
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-5 flex-1">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-center transition-colors group-hover:border-primary-100/50 relative overflow-hidden">
                                    <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-1/4 translate-y-1/4">
                                        <Users className="w-24 h-24" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center relative z-10">
                                        <Users className="w-4 h-4 mr-1.5 text-primary-500/70" />
                                        Bemanning (Aktiv)
                                    </span>
                                    <span className={`text-4xl font-extrabold tracking-tight relative z-10 ${sub.manpowerToday > 0 ? 'text-primary-700' : 'text-slate-700'}`}>
                                        {sub.manpowerToday}
                                    </span>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-center transition-colors group-hover:border-primary-100/50 relative overflow-hidden">
                                    <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none translate-x-1/4 translate-y-1/4">
                                        <DollarSign className="w-24 h-24" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center relative z-10">
                                        <DollarSign className="w-4 h-4 mr-1.5 text-green-500/70" />
                                        Kontraktsverdi
                                    </span>
                                    <span className="text-2xl font-extrabold text-slate-700 truncate relative z-10" title={`kr ${sub.currentValue.toLocaleString('no-NO')}`}>
                                        {sub.currentValue > 1000000
                                            ? `${(sub.currentValue / 1000000).toFixed(1)}M`
                                            : `${Math.round(sub.currentValue / 1000)}k`}
                                    </span>
                                </div>
                            </div>

                            {/* Action to select and navigate */}
                            <Link
                                to="/"
                                onClick={() => setSelectedSubcontractorId(sub.id)}
                                className="w-full mt-auto bg-white border border-slate-200 text-slate-700 hover:border-primary-500 group-hover:bg-primary-600 group-hover:text-white py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center transition-all shadow-sm"
                            >
                                Gå til underentreprenør <ChevronRight className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </div>
                    ))}

                    {subcontractorsData.length === 0 && !loading && (
                        <div className="w-full bg-slate-50 rounded-3xl border border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center">
                            <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-4">
                                <Building2 className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Ingen underentreprenører</h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-1">Gå til Kontakter for å legge til underentreprenører før du kan se oversikten her.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Activity Modal */}
            {showActivityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Ny aktivitet</h3>
                            <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateActivity} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Velg Underentreprenør / Fag</label>
                                <select required value={newActivity.subcontractor_id} onChange={(e) => setNewActivity({ ...newActivity, subcontractor_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all">
                                    <option value="">Velg fra listen...</option>
                                    {subcontractorsData.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.trade})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Aktivitetsnavn</label>
                                <input type="text" required value={newActivity.name} onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })} placeholder="F.eks. Montere gips plan 2" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center"><CalendarIcon className="w-3.5 h-3.5 mr-1 text-slate-400"/> Startdato</label>
                                    <input type="date" value={newActivity.start_date} onChange={(e) => setNewActivity({ ...newActivity, start_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary-500/50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center"><CalendarIcon className="w-3.5 h-3.5 mr-1 text-slate-400"/> Forventet ferdig</label>
                                    <input type="date" value={newActivity.expected_end_date} onChange={(e) => setNewActivity({ ...newActivity, expected_end_date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary-500/50" />
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center">Frist / Deadline (Valgfritt)</label>
                                <input type="date" value={newActivity.deadline} onChange={(e) => setNewActivity({ ...newActivity, deadline: e.target.value })} className="w-full bg-white border border-red-200/60 rounded-xl px-4 py-2.5 font-medium text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all" />
                                <p className="text-xs text-slate-500 mt-1">Dette vil utløse rød markering på dashbordet om fristen passeres.</p>
                            </div>

                            <div className="pt-2">
                                <button type="submit" disabled={creating} className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-75 flex justify-center items-center">
                                    {creating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Opprett aktivitet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
