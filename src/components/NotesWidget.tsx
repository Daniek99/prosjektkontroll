import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, ExternalLink, Cloud, Sun, CloudRain, Snowflake, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { useProject } from '../contexts/ProjectContext';

type NoteEntry = {
    id: string;
    date: string;
    content: string;
    weather: string;
    created_at: string;
    subcontractor_id: string | null;
};

const weatherIcons: Record<string, typeof Cloud> = {
    Sol: Sun,
    Overskyet: Cloud,
    Regn: CloudRain,
    Snø: Snowflake,
};

export default function NotesWidget({ selectedSubcontractorId: propSelectedSubcontractorId }: { selectedSubcontractorId?: string | null }) {
    const { selectedSubcontractorId: contextSelectedSubcontractorId, subcontractors } = useSubcontractor();
    const { canAccess } = useProject();
    const navigate = useNavigate();
    const selectedSubcontractorId = propSelectedSubcontractorId ?? contextSelectedSubcontractorId;

    const [notes, setNotes] = useState<NoteEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const canView = canAccess('diary');

    const loadNotes = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        }
        setLoading(true);
        let query = supabase
            .from('diary_entries')
            .select('id, date, content, weather, created_at, subcontractor_id')
            .order('date', { ascending: false })
            .limit(5);
        if (selectedSubcontractorId) {
            query = query.eq('subcontractor_id', selectedSubcontractorId);
        }
        const { data, error: err } = await query;
        if (err) {
            console.error('Error loading notes', err);
            setNotes([]);
        } else {
            setNotes((data ?? []) as NoteEntry[]);
        }
        setLoading(false);
    }, [canView, selectedSubcontractorId]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubcontractorId || !draft.trim()) return;
        setSaving(true);
        setError('');
        const today = new Date().toISOString().split('T')[0];
        const { error: err } = await supabase.from('diary_entries').insert([{
            subcontractor_id: selectedSubcontractorId,
            date: today,
            content: draft.trim(),
            weather: 'Overskyet',
        }]);
        setSaving(false);
        if (err) {
            setError(err.message);
            return;
        }
        setDraft('');
        await loadNotes();
    };

    if (!canView) return null;

    const subName = (id: string | null) =>
        subcontractors.find((s) => s.id === id)?.company_name ?? 'Ukjent';

    return (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <div className="bg-primary-50 p-1.5 rounded-lg mr-2">
                        <BookOpen className="w-3.5 h-3.5 text-primary-600" />
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-800">Notater</h3>
                </div>
                <button
                    onClick={() => navigate('/diary')}
                    className="flex items-center gap-1 text-[10px] font-bold text-primary-600 hover:text-primary-700 px-1.5 py-1 rounded hover:bg-primary-50 transition-colors"
                >
                    Se alle <ExternalLink className="w-3 h-3" />
                </button>
            </div>

            {selectedSubcontractorId ? (
                <form onSubmit={handleAdd} className="mb-2">
                    <div className="flex gap-1.5">
                        <input
                            type="text"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Skriv et raskt notat..."
                            className="flex-1 min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={saving || !draft.trim()}
                            className="shrink-0 px-2 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                            title="Lagre notat"
                        >
                            {saving
                                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Plus className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    {error && <p className="text-[9px] text-red-600 font-semibold mt-1">{error}</p>}
                </form>
            ) : (
                <p className="text-[10px] text-slate-400 text-center py-1 mb-1">Velg UE for å skrive et notat</p>
            )}

            {loading ? (
                <div className="flex justify-center py-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                </div>
            ) : notes.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-2">Ingen notater ennå.</p>
            ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {notes.map((note) => {
                        const Icon = weatherIcons[note.weather] ?? Cloud;
                        return (
                            <button
                                key={note.id}
                                onClick={() => navigate('/diary')}
                                className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 transition-colors"
                            >
                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {new Date(note.date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 min-w-0">
                                        <Icon className="w-2.5 h-2.5 shrink-0" />
                                        {!selectedSubcontractorId && (
                                            <span className="truncate max-w-[90px]">{subName(note.subcontractor_id)}</span>
                                        )}
                                    </span>
                                </div>
                                <p className="text-[10px] font-medium text-slate-700 line-clamp-2 whitespace-pre-wrap">{note.content}</p>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
