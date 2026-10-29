import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import {
    BookOpen, Plus, X, Calendar, Cloud, Sun, CloudRain, Snowflake, Pencil, Trash2,
    Folder, FolderPlus, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';
import DatePickerWithWeek from '../components/DatePickerWithWeek';
import { groupNotesByMonthWeek, parseNoteDate } from '../lib/noteGrouping';
import { cn } from '../lib/utils';

interface DiaryEntry {
    id: string;
    date: string;
    content: string;
    weather: string;
    created_at: string;
    subcontractor_id: string | null;
}

interface NoteFolder {
    id: string;
    name: string;
    sort_order: number;
}

interface NoteSection {
    id: string;
    folder_id: string;
    name: string;
    sort_order: number;
}

export default function Diary() {
    const { selectedProjectId, selectedProject } = useProject();
    const { user } = useAuth();

    const [entries, setEntries] = useState<DiaryEntry[]>([]);
    const [folders, setFolders] = useState<NoteFolder[]>([]);
    const [sections, setSections] = useState<NoteSection[]>([]);
    const [placements, setPlacements] = useState<Record<string, string>>({});
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
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

    const loadOrganization = useCallback(async () => {
        if (!user || !selectedProjectId) return;

        let { data: folderData } = await supabase
            .from('note_folders')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        // First run for this user/project: create a folder named after the project.
        if (!folderData || folderData.length === 0) {
            const { data: createdFolders } = await supabase
                .from('note_folders')
                .insert([{
                    user_id: user.id,
                    project_id: selectedProjectId,
                    name: selectedProject?.name || 'Notater',
                    sort_order: 0,
                }])
                .select('id, name, sort_order');

            if (createdFolders && createdFolders[0]) {
                await supabase.from('note_sections').insert([{
                    folder_id: createdFolders[0].id,
                    user_id: user.id,
                    project_id: selectedProjectId,
                    name: 'Notater',
                    sort_order: 0,
                }]);
                folderData = createdFolders;
            }
        }

        const { data: sectionData } = await supabase
            .from('note_sections')
            .select('id, folder_id, name, sort_order')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        const { data: placementData } = await supabase
            .from('note_placements')
            .select('note_id, section_id');

        const placementMap: Record<string, string> = {};
        (placementData ?? []).forEach((row: { note_id: string; section_id: string }) => {
            placementMap[row.note_id] = row.section_id;
        });

        setFolders((folderData ?? []) as NoteFolder[]);
        setSections((sectionData ?? []) as NoteSection[]);
        setPlacements(placementMap);
        setExpandedFolders((prev) => {
            const next = { ...prev };
            (folderData ?? []).forEach((folder: NoteFolder) => {
                if (next[folder.id] === undefined) next[folder.id] = true;
            });
            return next;
        });
    }, [user, selectedProjectId, selectedProject?.name]);

    const loadEntries = useCallback(async () => {
        // Notes are a property of the user and the project. RLS scopes the
        // query to the signed-in user and the selected project.
        const { data, error } = await supabase
            .from('diary_entries')
            .select('*')
            .order('date', { ascending: false });

        if (!error && data) {
            setEntries(data as DiaryEntry[]);
        }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadOrganization(), loadEntries()]);
        setLoading(false);
    }, [loadOrganization, loadEntries]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // Keep a valid section selected.
    useEffect(() => {
        if (sections.length === 0) {
            setSelectedSectionId(null);
            return;
        }
        if (!selectedSectionId || !sections.some((s) => s.id === selectedSectionId)) {
            setSelectedSectionId(sections[0].id);
        }
    }, [sections, selectedSectionId]);

    const defaultSectionId = useMemo(() => {
        const firstFolder = folders[0];
        if (!firstFolder) return null;
        return sections.find((s) => s.folder_id === firstFolder.id)?.id ?? null;
    }, [folders, sections]);

    const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

    const sectionEntries = useMemo(() => {
        return entries.filter((entry) => {
            const placed = placements[entry.id];
            if (selectedSectionId === defaultSectionId) {
                // The default section also shows notes that have not been placed yet.
                return !placed || placed === selectedSectionId;
            }
            return placed === selectedSectionId;
        });
    }, [entries, placements, selectedSectionId, defaultSectionId]);

    const groupedNotes = useMemo(() => groupNotesByMonthWeek(sectionEntries), [sectionEntries]);

    const sectionLabel = (section: NoteSection) => {
        const folder = folders.find((f) => f.id === section.folder_id);
        return folder ? `${folder.name} / ${section.name}` : section.name;
    };

    const placeNote = async (noteId: string, sectionId: string | null) => {
        if (!user || !selectedProjectId) return;
        if (!sectionId) {
            await supabase.from('note_placements').delete().eq('user_id', user.id).eq('note_id', noteId);
            setPlacements((prev) => {
                const next = { ...prev };
                delete next[noteId];
                return next;
            });
            return;
        }
        const { error } = await supabase
            .from('note_placements')
            .upsert([{
                user_id: user.id,
                note_id: noteId,
                section_id: sectionId,
                project_id: selectedProjectId,
            }], { onConflict: 'user_id,note_id' });
        if (!error) {
            setPlacements((prev) => ({ ...prev, [noteId]: sectionId }));
        }
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        const payload = {
            user_id: user.id,
            date: newEntry.date,
            content: newEntry.content,
            weather: newEntry.weather
        };

        if (newEntry.id) {
            const { data, error } = await supabase
                .from('diary_entries')
                .update(payload)
                .eq('id', newEntry.id)
                .select();

            if (!error && data) {
                setEntries((prev) => prev
                    .map((ent) => ent.id === newEntry.id ? data[0] as DiaryEntry : ent)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                setShowModal(false);
                resetForm();
            } else {
                alert(`En feil oppstod ved lagring: ${error?.message || 'Ukjent feil'}`);
            }
        } else {
            const { data, error } = await supabase
                .from('diary_entries')
                .insert([payload])
                .select();

            if (!error && data && data[0]) {
                const created = data[0] as DiaryEntry;
                setEntries((prev) => [created, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                if (selectedSectionId) {
                    await placeNote(created.id, selectedSectionId);
                }
                setShowModal(false);
                resetForm();
            } else {
                alert(`En feil oppstod ved lagring: ${error?.message || 'Ukjent feil'}`);
            }
        }
        setLoading(false);
    };

    const resetForm = () => {
        setNewEntry({
            date: new Date().toISOString().split('T')[0],
            content: '',
            weather: 'Overskyet'
        });
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
            setEntries((prev) => prev.filter((ent) => ent.id !== id));
            setPlacements((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } else {
            alert(`En feil oppstod ved sletting: ${error?.message || 'Ukjent feil'}`);
        }
        setLoading(false);
    };

    const handleCreateFolder = async () => {
        if (!user || !selectedProjectId) return;
        const name = window.prompt('Navn på ny mappe:');
        if (!name?.trim()) return;
        const { data, error } = await supabase
            .from('note_folders')
            .insert([{
                user_id: user.id,
                project_id: selectedProjectId,
                name: name.trim(),
                sort_order: folders.length,
            }])
            .select('id, name, sort_order');

        if (error || !data?.[0]) {
            alert(`Kunne ikke opprette mappe: ${error?.message || 'Ukjent feil'}`);
            return;
        }
        const folder = data[0] as NoteFolder;
        const { data: sectionData } = await supabase
            .from('note_sections')
            .insert([{
                folder_id: folder.id,
                user_id: user.id,
                project_id: selectedProjectId,
                name: 'Notater',
                sort_order: 0,
            }])
            .select('id, folder_id, name, sort_order');

        setFolders((prev) => [...prev, folder]);
        setExpandedFolders((prev) => ({ ...prev, [folder.id]: true }));
        if (sectionData?.[0]) {
            setSections((prev) => [...prev, sectionData[0] as NoteSection]);
            setSelectedSectionId(sectionData[0].id);
        }
    };

    const handleCreateSection = async (folderId: string) => {
        if (!user || !selectedProjectId) return;
        const name = window.prompt('Navn på ny seksjon:');
        if (!name?.trim()) return;
        const { data, error } = await supabase
            .from('note_sections')
            .insert([{
                folder_id: folderId,
                user_id: user.id,
                project_id: selectedProjectId,
                name: name.trim(),
                sort_order: sections.filter((s) => s.folder_id === folderId).length,
            }])
            .select('id, folder_id, name, sort_order');

        if (error || !data?.[0]) {
            alert(`Kunne ikke opprette seksjon: ${error?.message || 'Ukjent feil'}`);
            return;
        }
        setSections((prev) => [...prev, data[0] as NoteSection]);
        setSelectedSectionId(data[0].id);
    };

    const handleDeleteFolder = async (folderId: string) => {
        if (!window.confirm('Slette mappen og alle seksjonene i den? Notatene blir ikke slettet.')) return;
        const removedSectionIds = new Set(sections.filter((s) => s.folder_id === folderId).map((s) => s.id));
        const { error } = await supabase.from('note_folders').delete().eq('id', folderId);
        if (error) {
            alert(`Kunne ikke slette mappe: ${error.message}`);
            return;
        }
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        setSections((prev) => prev.filter((s) => s.folder_id !== folderId));
        setPlacements((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((noteId) => {
                if (removedSectionIds.has(next[noteId])) delete next[noteId];
            });
            return next;
        });
        if (selectedSectionId && removedSectionIds.has(selectedSectionId)) {
            setSelectedSectionId(null);
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!window.confirm('Slette seksjonen? Notatene blir ikke slettet.')) return;
        const { error } = await supabase.from('note_sections').delete().eq('id', sectionId);
        if (error) {
            alert(`Kunne ikke slette seksjon: ${error.message}`);
            return;
        }
        setSections((prev) => prev.filter((s) => s.id !== sectionId));
        setPlacements((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((noteId) => {
                if (next[noteId] === sectionId) delete next[noteId];
            });
            return next;
        });
        if (selectedSectionId === sectionId) {
            setSelectedSectionId(null);
        }
    };

    const getWeatherIcon = (weatherLabel: string) => {
        const option = weatherOptions.find(w => w.value === weatherLabel);
        if (option) {
            const Icon = option.icon;
            return <Icon className="w-4 h-4 text-slate-500" />;
        }
        return <Cloud className="w-4 h-4 text-slate-500" />;
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Notater</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Personlige mapper og seksjoner for prosjektet</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    disabled={!selectedSectionId}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors flex items-center shrink-0 disabled:opacity-50"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nytt Notat
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Folders / sections sidebar */}
                <aside className="lg:col-span-1 bg-white rounded-3xl border border-slate-200/60 shadow-sm p-4 h-fit">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">Mapper</h2>
                        <button
                            onClick={handleCreateFolder}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Ny mappe"
                        >
                            <FolderPlus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-2">
                        {folders.map((folder) => {
                            const folderSections = sections.filter((s) => s.folder_id === folder.id);
                            const expanded = expandedFolders[folder.id] ?? true;
                            return (
                                <div key={folder.id}>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setExpandedFolders((prev) => ({ ...prev, [folder.id]: !expanded }))}
                                            className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                        >
                                            {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                                            <Folder className="w-3.5 h-3.5 shrink-0 text-primary-500" />
                                            <span className="truncate">{folder.name}</span>
                                        </button>
                                        <button
                                            onClick={() => handleCreateSection(folder.id)}
                                            className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                                            title="Ny seksjon"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFolder(folder.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Slett mappe"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {expanded && (
                                        <div className="ml-5 mt-1 space-y-0.5">
                                            {folderSections.map((section) => (
                                                <div key={section.id} className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setSelectedSectionId(section.id)}
                                                        className={cn(
                                                            'flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                                                            selectedSectionId === section.id
                                                                ? 'bg-primary-50 text-primary-700'
                                                                : 'text-slate-600 hover:bg-slate-50'
                                                        )}
                                                    >
                                                        <FileText className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{section.name}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSection(section.id)}
                                                        className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Slett seksjon"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {folderSections.length === 0 && (
                                                <p className="text-[10px] text-slate-400 px-2 py-1">Ingen seksjoner</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {folders.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-4">Ingen mapper ennå.</p>
                        )}
                    </div>
                </aside>

                {/* Notes for the selected section */}
                <section className="lg:col-span-3 space-y-4">
                    <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm">
                        <div>
                            <h2 className="text-lg font-extrabold text-slate-800">{selectedSection?.name ?? 'Velg seksjon'}</h2>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                                {sectionEntries.length} notater
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                    ) : groupedNotes.length === 0 ? (
                        <div className="bg-white p-12 text-center text-slate-500 font-medium border border-slate-200 rounded-3xl shadow-sm">
                            Ingen notater i denne seksjonen. Klikk "Nytt Notat" for å begynne.
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {groupedNotes.map((month) => (
                                <div key={month.key}>
                                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2 px-1">
                                        {month.label}
                                    </h3>
                                    <div className="space-y-3">
                                        {month.weeks.map((week) => (
                                            <div key={week.key}>
                                                <div className="flex items-center gap-2 px-1 mb-1.5">
                                                    <span className="text-[10px] font-bold text-primary-600 uppercase tracking-wider">{week.label}</span>
                                                    <span className="flex-1 h-px bg-slate-200" />
                                                </div>
                                                <div className="space-y-2">
                                                    {week.notes.map((entry) => (
                                                        <div key={entry.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60">
                                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                    {parseNoteDate(entry.date).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                                </span>
                                                                <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                                    {getWeatherIcon(entry.weather)}
                                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{entry.weather}</span>
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                                                                {entry.content}
                                                            </div>
                                                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                                <select
                                                                    value={placements[entry.id] ?? ''}
                                                                    onChange={(e) => placeNote(entry.id, e.target.value || null)}
                                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary-500/50 max-w-[220px]"
                                                                    title="Flytt til seksjon"
                                                                >
                                                                    <option value="">Uplassert</option>
                                                                    {sections.map((section) => (
                                                                        <option key={section.id} value={section.id}>{sectionLabel(section)}</option>
                                                                    ))}
                                                                </select>
                                                                <div className="flex gap-3">
                                                                    <button onClick={() => handleEditClick(entry)} className="flex items-center text-primary-600 hover:text-primary-700 transition-colors text-xs font-bold">
                                                                        <Pencil className="w-3.5 h-3.5 mr-1" />
                                                                        Rediger
                                                                    </button>
                                                                    <button onClick={() => handleDeleteClick(entry.id)} className="flex items-center text-red-600 hover:text-red-700 transition-colors text-xs font-bold">
                                                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                                                        Slett
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Add / edit note modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">{newEntry.id ? 'Rediger notat' : 'Skriv notat'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddEntry} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Dato</label>
                                    <DatePickerWithWeek
                                        selected={newEntry.date ? new Date(newEntry.date) : null}
                                        onChange={(date) => setNewEntry({ ...newEntry, date: date ? date.toISOString().split('T')[0] : '' })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50 text-slate-900"
                                        required
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
