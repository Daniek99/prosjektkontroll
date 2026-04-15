import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { BookOpen, Plus, X, Calendar, Cloud, Sun, CloudRain, Snowflake, Pencil, Trash2 } from 'lucide-react';

interface DiaryEntry {
    id: string;
    date: string;
    content: string;
    weather: string;
    created_at: string;
}

export default function Diary() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [newEntry, setNewEntry] = useState<{ id?: string, date: string, content: string, weather: string }>({
        date: new Date().toISOString().split('T')[0],
        content: '',
        weather: 'Overskyet'
    });

    const weatherOptions = [
        { label: 'Sol', icon: Sun, value: 'Sol' },
        { label: 'Overskyet', icon: Cloud, value: 'Overskyet' },
        { label: 'Regn', icon: CloudRain, value: 'Regn' },
        { label: 'Snø', icon: Snowflake, value: 'Snø' }
    ];

    useEffect(() => {
        if (!selectedSubcontractorId) {
            setLoading(false);
            return;
        }

        async function fetchEntries() {
            setLoading(true);
            const { data, error } = await supabase
                .from('diary_entries')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('date', { ascending: false });

            if (!error && data) {
                setEntries(data as DiaryEntry[]);
            }
            setLoading(false);
        }

        fetchEntries();
    }, [selectedSubcontractorId]);

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            subcontractor_id: selectedSubcontractorId,
            date: newEntry.date,
            content: newEntry.content,
            weather: newEntry.weather
        };

        let result;

        if (newEntry.id) {
            result = await supabase.from('diary_entries').update(payload).eq('id', newEntry.id).select();
        } else {
            result = await supabase.from('diary_entries').insert([payload]).select();
        }

        const { data, error } = result;

        if (!error && data) {
            if (newEntry.id) {
                setEntries(entries.map(ent => ent.id === newEntry.id ? data[0] as DiaryEntry : ent).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } else {
                const updated = [data[0] as DiaryEntry, ...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setEntries(updated);
            }
            setShowModal(false);
            setNewEntry({
                date: new Date().toISOString().split('T')[0],
                content: '',
                weather: 'Overskyet'
            });
        } else {
            alert(`En feil oppstod ved lagring: ${error?.message || 'Ukjent feil'}`);
        }
        setLoading(false);
    };

    const handleEditClick = (entry: DiaryEntry) => {
        setNewEntry({
            id: entry.id,
            date: entry.date,
            content: entry.content,
            weather: entry.weather
        });
        setShowModal(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!window.confirm('Er du sikker på at du vil slette dette notatet?')) return;
        setLoading(true);
        const { error } = await supabase.from('diary_entries').delete().eq('id', id);
        if (!error) {
            setEntries(entries.filter(ent => ent.id !== id));
        } else {
            alert(`En feil oppstod ved sletting: ${error?.message || 'Ukjent feil'}`);
        }
        setLoading(false);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <BookOpen className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å skrive i dagboken.</p>
            </div>
        );
    }

    const getWeatherIcon = (weatherLabel: string) => {
        const option = weatherOptions.find(w => w.value === weatherLabel);
        if (option) {
            const Icon = option.icon;
            return <Icon className="w-4 h-4 text-slate-500" />;
        }
        return <Cloud className="w-4 h-4 text-slate-500" />;
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dagbok & Notater</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Løpende oppfølging av underentreprenøren</p>
                </div>
                <button onClick={() => {
                    setNewEntry({
                        date: new Date().toISOString().split('T')[0],
                        content: '',
                        weather: 'Overskyet'
                    });
                    setShowModal(true);
                }} className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors flex items-center shrink-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nytt Notat
                </button>
            </div>

            <div className="relative">
                {/* Timeline vertical line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200/80 -z-10 hidden sm:block"></div>

                {loading ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : entries.length === 0 ? (
                    <div className="bg-white p-12 text-center text-slate-500 font-medium border border-slate-200 rounded-3xl shadow-sm">
                        Ingen dagboknotater funnet for denne underentreprenøren. Klikk "Nytt Notat" for å begynne.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {entries.map((entry) => (
                            <div key={entry.id} className="flex flex-col sm:flex-row gap-4 sm:gap-6 relative">
                                <div className="sm:w-28 shrink-0 flex flex-col sm:items-end sm:pt-4 z-10">
                                    <div className="flex items-center sm:hidden mb-2 text-primary-600 font-bold">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        {new Date(entry.date).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    </div>
                                    <div className="hidden sm:flex flex-col items-center justify-center p-3 bg-white rounded-2xl border-2 border-slate-200/60 shadow-sm">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                                            {new Date(entry.date).toLocaleDateString('no-NO', { month: 'short' })}
                                        </span>
                                        <span className="text-2xl font-extrabold text-slate-900 leading-none">
                                            {new Date(entry.date).getDate()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200/60 group hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wider hidden sm:block">
                                            {new Date(entry.date).toLocaleDateString('no-NO', { weekday: 'long' })}
                                        </span>
                                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wider sm:hidden block"></span>
                                        <div className="flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            {getWeatherIcon(entry.weather)}
                                            <span className="ml-2 text-xs font-bold text-slate-600 uppercase tracking-widest">{entry.weather}</span>
                                        </div>
                                    </div>
                                    <div className="prose prose-slate prose-sm max-w-none text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                                        {entry.content}
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center text-xs font-bold text-slate-400">
                                        <span>Loggført: {new Date(entry.created_at).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <div className="flex gap-4">
                                            <button onClick={() => handleEditClick(entry)} className="flex items-center text-primary-600 hover:text-primary-700 transition-colors p-1 -m-1">
                                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                                Rediger
                                            </button>
                                            <button onClick={() => handleDeleteClick(entry.id)} className="flex items-center text-red-600 hover:text-red-700 transition-colors p-1 -m-1">
                                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                Slett
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Diary Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">{newEntry.id ? 'Rediger Dagboknotat' : 'Skriv Dagboknotat'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddEntry} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Dato</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEntry.date}
                                        onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Værforhold</label>
                                    <select
                                        value={newEntry.weather}
                                        onChange={(e) => setNewEntry({ ...newEntry, weather: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    >
                                        {weatherOptions.map(w => (
                                            <option key={w.value} value={w.value}>{w.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dagens hendelser og notater</label>
                                <textarea
                                    required
                                    rows={8}
                                    value={newEntry.content}
                                    onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                    placeholder="Fortell hva som skjedde i dag..."
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : 'Lagre Notat'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
