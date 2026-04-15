import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Building2, Users, DollarSign, ChevronRight } from 'lucide-react';
import TodoList from '../components/TodoList';
import SubcontractorTodoList from '../components/SubcontractorTodoList';
import CalendarWidget from '../components/CalendarWidget';
import { Link } from 'react-router-dom';



export default function Dashboard() {
    const { setSelectedSubcontractorId } = useSubcontractor();
    const [subcontractorsData, setSubcontractorsData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadGlobalDashboard() {
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

            setLoading(false);
        }

        loadGlobalDashboard();
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
                <div className="h-full">
                    <CalendarWidget />
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

        </div>
    );
}
