import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { Flag, Plus, X, Search, Building2, Calendar, Mail, FileText } from 'lucide-react';

interface DecisionLog {
    id: string;
    subcontractor_id: string | null;
    area_id: string | null;
    subject: string;
    content: string;
    date: string;
    created_at: string;
    global_areas?: {
        building: string;
        floor: string;
        zone: string;
    } | null;
    subcontractors?: {
        company_name: string;
    } | null;
}

interface Area {
    id: string;
    building: string;
    floor: string;
    zone: string;
}

// Since we want this to be global, we don't strictly require a single selected subcontractor,
// but we'll fetch logs accordingly. If a sub is selected, we could filter by them, 
// but often standard emails apply to specific subs. We will fetch all logs for the current company!
export default function Decisions() {
    const { selectedSubcontractorId, subcontractors } = useSubcontractor();
    const [logs, setLogs] = useState<DecisionLog[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    
    // UI state
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form state
    const [newLog, setNewLog] = useState<{
        subject: string;
        content: string;
        date: string;
        subcontractor_id: string;
        area_id: string;
    }>({
        subject: '',
        content: '',
        date: new Date().toISOString().split('T')[0],
        subcontractor_id: '',
        area_id: ''
    });

    useEffect(() => {
        fetchData();
    }, [selectedSubcontractorId]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch global areas for dropdown
        const { data: areasData } = await supabase.from('global_areas').select('*');
        if (areasData) setAreas(areasData);

        // Fetch logs
        let query = supabase
            .from('decision_logs')
            .select(`
                *,
                global_areas(building, floor, zone),
                subcontractors(company_name)
            `)
            .order('date', { ascending: false });

        if (selectedSubcontractorId) {
            query = query.eq('subcontractor_id', selectedSubcontractorId);
        }

        const { data: logsData } = await query;
        if (logsData) {
            setLogs(logsData as unknown as DecisionLog[]);
        }
        
        setLoading(false);
    };

    const handleSaveLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            subject: newLog.subject,
            content: newLog.content,
            date: newLog.date,
            subcontractor_id: newLog.subcontractor_id || null,
            area_id: newLog.area_id || null
        };

        const { error } = await supabase.from('decision_logs').insert([payload]);

        if (!error) {
            fetchData();
            setShowModal(false);
            setNewLog({
                subject: '',
                content: '',
                date: new Date().toISOString().split('T')[0],
                subcontractor_id: '',
                area_id: ''
            });
        } else {
            alert('Kunne ikke lagre logg: ' + error.message);
        }
        setLoading(false);
    };

    const filteredLogs = logs.filter(log => 
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        log.content?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
                        <Flag className="w-7 h-7 mr-3 text-primary-600" />
                        Beslutningslogg
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Søkbar tidslinje for viktige e-poster og beslutninger</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Søk i logg..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary-500/50 w-full sm:w-64 transition-all"
                        />
                    </div>
                    <button onClick={() => setShowModal(true)} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Loggfør
                    </button>
                </div>
            </div>

            {loading && logs.length === 0 ? (
                <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white p-12 text-center text-slate-500 font-medium border border-slate-200 rounded-3xl shadow-sm">
                    {searchTerm ? "Ingen treff for søket ditt." : "Ingen beslutninger loggført enda. Klikk 'Loggfør' for å starte."}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col sm:flex-row gap-6 hover:shadow-md transition-shadow">
                            <div className="sm:w-48 shrink-0 flex flex-col gap-3 border-b sm:border-b-0 sm:border-r border-slate-100 pb-4 sm:pb-0">
                                <div className="flex items-center text-slate-700 font-bold text-sm">
                                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                    {new Date(log.date).toLocaleDateString('no-NO')}
                                </div>
                                {log.subcontractors && (
                                    <div className="flex items-center text-slate-600 text-sm font-medium">
                                        <Building2 className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                                        <span className="truncate">{log.subcontractors.company_name}</span>
                                    </div>
                                )}
                                {log.global_areas && (
                                    <div className="flex items-start text-slate-600 text-sm font-medium">
                                        <FileText className="w-4 h-4 mr-2 text-slate-400 shrink-0 mt-0.5" />
                                        <span className="leading-tight">{log.global_areas.building} - {log.global_areas.floor} {log.global_areas.zone}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1">
                                <h3 className="text-lg font-extrabold text-slate-800 mb-2">{log.subject}</h3>
                                <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                                    {log.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for adding log */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <Mail className="w-5 h-5 mr-2 text-slate-400" />
                                Loggfør Beslutning / E-post
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveLog} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Emne / Tittel</label>
                                <input
                                    type="text"
                                    required
                                    value={newLog.subject}
                                    onChange={(e) => setNewLog({ ...newLog, subject: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    placeholder="F.eks: Avklaring rundt kabelbro Høyblokk"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Dato</label>
                                    <input
                                        type="date"
                                        required
                                        value={newLog.date}
                                        onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Underentreprenør</label>
                                    <select
                                        value={newLog.subcontractor_id}
                                        onChange={(e) => setNewLog({ ...newLog, subcontractor_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    >
                                        <option value="">(Ingen valgt)</option>
                                        {subcontractors.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Område</label>
                                    <select
                                        value={newLog.area_id}
                                        onChange={(e) => setNewLog({ ...newLog, area_id: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    >
                                        <option value="">(Generelt)</option>
                                        {areas.map(a => (
                                            <option key={a.id} value={a.id}>{a.building} - {a.floor} {a.zone}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Innhold / Beskjed</label>
                                <textarea
                                    required
                                    rows={8}
                                    value={newLog.content}
                                    onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    placeholder="Lim inn innholdet fra e-posten eller beskriv beslutningen..."
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : 'Lagre Logg'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
