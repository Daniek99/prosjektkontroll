import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PenTool, Plus, ChevronDown, ChevronUp, ExternalLink, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';

type DecisionLog = {
    id: string;
    subject: string;
    content: string | null;
    date: string;
    subcontractor_id: string | null;
    created_at: string;
};

export default function DecisionLogWidget({ selectedSubcontractorId: propSelectedSubcontractorId }: { selectedSubcontractorId?: string | null }) {
    const { selectedSubcontractorId: contextSelectedSubcontractorId, subcontractors } = useSubcontractor();
    const { canAccess } = useProject();
    const { user } = useAuth();
    const navigate = useNavigate();
    const selectedSubcontractorId = propSelectedSubcontractorId ?? contextSelectedSubcontractorId;

    const [expanded, setExpanded] = useState(false);
    const [logs, setLogs] = useState<DecisionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        subject: '',
        content: '',
        date: new Date().toISOString().split('T')[0],
    });

    const canView = canAccess('decisions');

    const loadLogs = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        }
        setLoading(true);
        let query = supabase
            .from('decision_logs')
            .select('id, subject, content, date, subcontractor_id, created_at')
            .order('date', { ascending: false })
            .limit(20);
        if (selectedSubcontractorId) {
            query = query.eq('subcontractor_id', selectedSubcontractorId);
        }
        const { data, error: err } = await query;
        if (err) {
            console.error('Error loading decision logs', err);
            setLogs([]);
        } else {
            setLogs((data ?? []) as DecisionLog[]);
        }
        setLoading(false);
    }, [canView, selectedSubcontractorId]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.subject.trim()) return;
        setSaving(true);
        setError('');
        const { error: err } = await supabase.from('decision_logs').insert([{
            subject: form.subject.trim(),
            content: form.content.trim() || null,
            date: form.date,
            subcontractor_id: selectedSubcontractorId || null,
            created_by: user?.id ?? null,
        }]);
        setSaving(false);
        if (err) {
            setError(err.message);
            return;
        }
        setForm({ subject: '', content: '', date: new Date().toISOString().split('T')[0] });
        await loadLogs();
    };

    if (!canView) return null;

    const subName = (id: string | null) =>
        subcontractors.find((s) => s.id === id)?.company_name ?? 'Alle';

    const latest = logs[0];

    return (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center min-w-0">
                    <div className="bg-primary-50 p-1.5 rounded-lg mr-2 shrink-0">
                        <PenTool className="w-3.5 h-3.5 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-slate-800">Prosjektering</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {logs.length} beslutninger
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => navigate('/decisions')}
                        className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title="Åpne prosjektering"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setExpanded((prev) => !prev)}
                        className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                        title={expanded ? 'Skjul' : 'Utvid'}
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {!expanded ? (
                <div className="mt-2">
                    {loading ? (
                        <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        </div>
                    ) : latest ? (
                        <button
                            onClick={() => setExpanded(true)}
                            className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(`${latest.date}T00:00:00`).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 truncate max-w-[90px]">
                                    {subName(latest.subcontractor_id)}
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-700 truncate">{latest.subject}</p>
                        </button>
                    ) : (
                        <p className="text-[10px] text-slate-400 text-center py-2">Ingen beslutninger ennå.</p>
                    )}
                </div>
            ) : (
                <div className="mt-2 space-y-2">
                    <form onSubmit={handleAdd} className="space-y-1.5">
                        <input
                            type="text"
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            placeholder="Emne / beslutning..."
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 placeholder:text-slate-400"
                        />
                        <textarea
                            rows={2}
                            value={form.content}
                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                            placeholder="Beskrivelse (valgfritt)..."
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 placeholder:text-slate-400 resize-none"
                        />
                        <div className="flex gap-1.5">
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                                className="flex-1 min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                            />
                            <button
                                type="submit"
                                disabled={saving || !form.subject.trim()}
                                className="shrink-0 px-2 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                                title="Logg beslutning"
                            >
                                {saving
                                    ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Plus className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {error && <p className="text-[9px] text-red-600 font-semibold">{error}</p>}
                    </form>

                    {loading ? (
                        <div className="flex justify-center py-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-2">Ingen beslutninger ennå.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {logs.map((log) => (
                                <button
                                    key={log.id}
                                    onClick={() => navigate('/decisions')}
                                    className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {new Date(`${log.date}T00:00:00`).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 truncate max-w-[90px]">
                                            {subName(log.subcontractor_id)}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-700 truncate">{log.subject}</p>
                                    {log.content && (
                                        <p className="text-[9px] font-medium text-slate-500 line-clamp-2 whitespace-pre-wrap">{log.content}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
