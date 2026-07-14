import { useState, useEffect, useRef } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { ClipboardList, Plus, X, ArrowUpDown, ExternalLink, Pencil, Check, Trash2, Filter } from 'lucide-react';
import DatePickerWithWeek from './DatePickerWithWeek';
import { useNavigate } from 'react-router-dom';

interface Activity {
    id: string;
    name: string;
    description?: string;
    subcontractor_id: string;
    status?: string;
    start_date?: string;
    expected_end_date?: string;
    deadline?: string;
    change_order_number?: string;
    is_active?: boolean;
}

export default function ActivityRegisterWidget({ selectedSubcontractorId: propSelectedSubcontractorId }: { selectedSubcontractorId?: string | null }) {
    const { selectedSubcontractorId: contextSelectedSubcontractorId, subcontractors } = useSubcontractor();
    const selectedSubcontractorId = propSelectedSubcontractorId ?? contextSelectedSubcontractorId;
    const navigate = useNavigate();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newActivity, setNewActivity] = useState({ name: '', start_date: '', expected_end_date: '', deadline: '', subcontractor_id: '' });
    const [creating, setCreating] = useState(false);
    const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
    const [sortAsc, setSortAsc] = useState(true);
    const [hideCompleted, setHideCompleted] = useState(true);
    const [showInProgress, setShowInProgress] = useState(true);

    // Multi-select for the expanded view
    const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
    const [showSubDropdown, setShowSubDropdown] = useState(false);
    const [activitiesBySub, setActivitiesBySub] = useState<Record<string, Activity[]>>({});
    const [subFilters, setSubFilters] = useState<Record<string, { showInProgress: boolean; showCompleted: boolean }>>({});

    // Inline editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Activity>>({});
    const [saving, setSaving] = useState(false);

    // Scroll preservation: keeps the user in the same spot after data changes.
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const scrollTopRef = useRef<number>(0);
    const preserveScroll = (fn: () => void) => {
        if (scrollRef.current) scrollTopRef.current = scrollRef.current.scrollTop;
        fn();
        // Restore after React commits the update (next frame).
        requestAnimationFrame(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollTopRef.current;
        });
    };

    // Per-subcontractor inline "add activity" form
    const [addFormSubId, setAddFormSubId] = useState<string | null>(null);
    const [addFormName, setAddFormName] = useState('');
    const [addFormStart, setAddFormStart] = useState('');
    const [addFormStatus, setAddFormStatus] = useState<'planned' | 'in_progress' | 'completed'>('planned');
    const [addingForSub, setAddingForSub] = useState(false);

    function openAddForm(subId: string) {
        setAddFormSubId(subId);
        setAddFormName('');
        setAddFormStart('');
        setAddFormStatus('planned');
    }

    function closeAddForm() {
        setAddFormSubId(null);
        setAddFormName('');
        setAddFormStart('');
        setAddFormStatus('planned');
    }

    async function handleQuickAddForSub(subId: string) {
        if (!addFormName.trim() || !subId) return;
        setAddingForSub(true);
        const { data, error } = await supabase.from('work_activities').insert([{
            name: addFormName.trim(),
            subcontractor_id: subId,
            start_date: addFormStart || null,
            expected_end_date: null,
            deadline: null,
            status: addFormStatus,
            is_active: true
        }]).select();
        setAddingForSub(false);
        if (!error && data) {
            const created = data[0] as Activity;
            preserveScroll(() => {
                setActivitiesBySub(prev => {
                    const next = { ...prev };
                    next[subId] = [created, ...(next[subId] || [])];
                    return next;
                });
                setActivities(prev => [created, ...prev]);
                closeAddForm();
            });
        } else {
            alert('Kunne ikke legge til aktivitet: ' + (error?.message || 'ukjent feil'));
        }
    }

    useEffect(() => {
        loadActivities();
    }, [selectedSubcontractorId]);

    async function loadAllActivities(subIds: string[]) {
        if (subIds.length === 0) {
            setActivitiesBySub({});
            return;
        }
        const { data, error } = await supabase
            .from('work_activities')
            .select('*')
            .in('subcontractor_id', subIds)
            .eq('is_active', true)
            .order('start_date', { ascending: false });
        if (!error && data) {
            const map: Record<string, Activity[]> = {};
            subIds.forEach(id => { map[id] = []; });
            data.forEach((a: Activity) => {
                if (!map[a.subcontractor_id]) map[a.subcontractor_id] = [];
                map[a.subcontractor_id].push(a);
            });
            setActivitiesBySub(map);
        }
    }

    // Initialize multi-select and refetch when expanded opens or selection changes
    useEffect(() => {
        if (expanded) {
            if (selectedSubIds.length === 0 && subcontractors.length > 0) {
                if (propSelectedSubcontractorId) {
                    setSelectedSubIds([propSelectedSubcontractorId]);
                } else {
                    setSelectedSubIds(subcontractors.map(s => s.id));
                }
            } else if (selectedSubIds.length > 0) {
                loadAllActivities(selectedSubIds);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded, selectedSubIds]);

    async function loadActivities() {
        if (!selectedSubcontractorId) {
            setActivities([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('work_activities')
            .select('*')
            .eq('subcontractor_id', selectedSubcontractorId)
            .eq('is_active', true)
            .order('start_date', { ascending: false });

        if (!error && data) setActivities(data);
        setLoading(false);
    }

    async function handleCreateActivity(e: React.FormEvent) {
        e.preventDefault();
        const subId = newActivity.subcontractor_id || selectedSubcontractorId;
        if (!newActivity.name || !subId) return;
        setCreating(true);
        const { data, error } = await supabase.from('work_activities').insert([{
            name: newActivity.name,
            subcontractor_id: subId,
            start_date: newActivity.start_date || null,
            expected_end_date: newActivity.expected_end_date || null,
            deadline: newActivity.deadline || null,
            status: 'planned',
            is_active: true
        }]).select();
        setCreating(false);
        if (!error && data) {
            setShowNewForm(false);
            setNewActivity({ name: '', start_date: '', expected_end_date: '', deadline: '', subcontractor_id: '' });
            // Update local state in place (no full refetch — keeps scroll position)
            const created = data[0] as Activity;
            preserveScroll(() => {
                setActivitiesBySub(prev => {
                    const next = { ...prev };
                    next[subId] = [created, ...(next[subId] || [])];
                    return next;
                });
                setActivities(prev => [created, ...prev]);
            });
        }
    }

    function startEditing(act: Activity) {
        setEditingId(act.id);
        setEditData({
            name: act.name,
            status: act.status,
            start_date: act.start_date || '',
            expected_end_date: act.expected_end_date || '',
            deadline: act.deadline || '',
        });
    }

    function cancelEditing() {
        setEditingId(null);
        setEditData({});
    }

    async function saveEditing() {
        if (!editingId || !editData.name) return;
        setSaving(true);
        const { error } = await supabase
            .from('work_activities')
            .update({
                name: editData.name,
                status: editData.status,
                start_date: editData.start_date || null,
                expected_end_date: editData.expected_end_date || null,
                deadline: editData.deadline || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', editingId);
        setSaving(false);
        if (!error) {
            const editingIdValue = editingId;
            const editingSubId = activitiesBySub ? Object.keys(activitiesBySub).find(sid => (activitiesBySub[sid] || []).some(a => a.id === editingIdValue)) : null;
            const updated: Activity = {
                ...activities.find(a => a.id === editingIdValue)!,
                ...editData,
                id: editingIdValue,
            } as Activity;
            preserveScroll(() => {
                setEditingId(null);
                setEditData({});
                // Update in place
                setActivities(prev => prev.map(a => a.id === editingIdValue ? updated : a));
                if (editingSubId) {
                    setActivitiesBySub(prev => {
                        const next = { ...prev };
                        next[editingSubId] = (next[editingSubId] || []).map(a => a.id === editingIdValue ? updated : a);
                        return next;
                    });
                }
            });
        }
    }

    async function deleteActivity(actId: string) {
        if (!confirm('Er du sikker på at du vil slette denne aktiviteten?')) return;
        const { error } = await supabase
            .from('work_activities')
            .update({ is_active: false })
            .eq('id', actId);
        if (!error) {
            preserveScroll(() => {
                setActivities(prev => prev.filter(a => a.id !== actId));
                setActivitiesBySub(prev => {
                    const next = { ...prev };
                    Object.keys(next).forEach(sid => {
                        next[sid] = (next[sid] || []).filter(a => a.id !== actId);
                    });
                    return next;
                });
            });
        }
    }

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700';
            case 'in_progress': return 'bg-amber-100 text-amber-700';
            case 'planned': return 'bg-blue-100 text-blue-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'completed': return 'Ferdig';
            case 'in_progress': return 'Påbegynt';
            case 'planned': return 'Planlagt';
            default: return 'Ukjent';
        }
    };

    let sortedActivities = [...activities];
    if (hideCompleted) sortedActivities = sortedActivities.filter(a => a.status !== 'completed');
    if (!showInProgress) sortedActivities = sortedActivities.filter(a => a.status !== 'in_progress');
    if (sortBy === 'date') {
        sortedActivities.sort((a, b) => {
            const da = a.start_date ? new Date(a.start_date).getTime() : 0;
            const db = b.start_date ? new Date(b.start_date).getTime() : 0;
            return sortAsc ? da - db : db - da;
        });
    } else {
        const order: Record<string, number> = { completed: 0, in_progress: 1, planned: 2 };
        sortedActivities.sort((a, b) => {
            const oa = order[a.status || ''] ?? 3;
            const ob = order[b.status || ''] ?? 3;
            return sortAsc ? oa - ob : ob - oa;
        });
    }

    if (!selectedSubcontractorId) {
        return (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm flex flex-col items-center justify-center min-h-[120px]">
                <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-medium">Velg underentreprenør</p>
            </div>
        );
    }

    if (expanded) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <ClipboardList className="w-5 h-5 mr-2 text-primary-500" />
                                Aktivitetsregister
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">Klikk på en rad for å redigere navn, datoer og status.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setExpanded(false); navigate('/progress'); }} className="px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1.5">
                                <ExternalLink className="w-3.5 h-3.5" /> Fullt register
                            </button>
                            <button onClick={() => setShowNewForm(!showNewForm)} className="px-3 py-2 bg-primary-600 text-white text-xs font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center">
                                <Plus className="w-4 h-4 mr-1" /> Ny Aktivitet
                            </button>
                            <button onClick={() => { setExpanded(false); setShowNewForm(false); cancelEditing(); }} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {showNewForm && (
                        <div className="px-6 py-4 border-b border-slate-100 bg-primary-50/30">
                            <form onSubmit={handleCreateActivity} className="flex gap-3 items-end flex-wrap">
                                <div className="flex-1 min-w-[180px]">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Aktivitetsnavn</label>
                                    <input type="text" required value={newActivity.name} onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="F.eks. Puss av søyler" />
                                </div>
                                <div className="w-48">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Underentreprenør</label>
                                    <select
                                        value={newActivity.subcontractor_id || selectedSubcontractorId || ''}
                                        onChange={(e) => setNewActivity({ ...newActivity, subcontractor_id: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    >
                                        <option value="">Velg underentreprenør</option>
                                        {subcontractors.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-40">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Startdato</label>
                                    <DatePickerWithWeek selected={newActivity.start_date ? new Date(newActivity.start_date) : null} onChange={(d) => setNewActivity({ ...newActivity, start_date: d ? d.toISOString().split('T')[0] : '' })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/50" />
                                </div>
                                <div className="w-40">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Forventet ferdig</label>
                                    <DatePickerWithWeek selected={newActivity.expected_end_date ? new Date(newActivity.expected_end_date) : null} onChange={(d) => setNewActivity({ ...newActivity, expected_end_date: d ? d.toISOString().split('T')[0] : '' })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500/50" />
                                </div>
                                <button type="submit" disabled={creating || !newActivity.name || !(newActivity.subcontractor_id || selectedSubcontractorId)} className="px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 shrink-0">
                                    {creating ? 'Oppretter...' : 'Opprett'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Subcontractor Multi-Select */}
                    <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <button onClick={() => setShowSubDropdown(!showSubDropdown)} className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5" />
                                Underentreprenører ({selectedSubIds.length})
                            </button>
                            {showSubDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowSubDropdown(false)} />
                                    <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-80 overflow-hidden flex flex-col">
                                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Velg underentreprenører</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedSubIds(subcontractors.map(s => s.id))} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">Velg alle</button>
                                                <button onClick={() => setSelectedSubIds([])} className="text-[10px] font-bold text-red-500 hover:text-red-600">Fjern alle</button>
                                            </div>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-2">
                                            {[...subcontractors].sort((a, b) => {
                                                const aP = a.type === 'project' ? 1 : 0, bP = b.type === 'project' ? 1 : 0;
                                                if (aP !== bP) return aP - bP;
                                                return a.company_name.localeCompare(b.company_name, 'no');
                                            }).map(s => (
                                                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                                    <input type="checkbox" checked={selectedSubIds.includes(s.id)} onChange={() => {
                                                        setSelectedSubIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]);
                                                    }} className="w-3.5 h-3.5 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                                                    <span className="text-xs font-bold text-slate-700 truncate flex-1">{s.company_name}</span>
                                                    {s.type === 'project' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">Prosjekt</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{Object.values(activitiesBySub).reduce((sum, arr) => sum + arr.length, 0)} aktiviteter</span>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                        ) : selectedSubIds.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                                <p className="font-medium text-sm">Velg underentreprenører for å vise aktiviteter.</p>
                            </div>
                        ) : (
                            [...subcontractors].filter(s => selectedSubIds.includes(s.id)).sort((a, b) => {
                                const aP = a.type === 'project' ? 1 : 0, bP = b.type === 'project' ? 1 : 0;
                                if (aP !== bP) return aP - bP;
                                return a.company_name.localeCompare(b.company_name, 'no');
                            }).map(sub => {
                                const subActs = activitiesBySub[sub.id] || [];
                                const filters = subFilters[sub.id] || { showInProgress: true, showCompleted: false };
                                const visibleActs = subActs.filter(a => {
                                    if (!filters.showInProgress && a.status === 'in_progress') return false;
                                    if (!filters.showCompleted && a.status === 'completed') return false;
                                    return true;
                                });
                                return (
                                    <div key={sub.id} className={`rounded-2xl border overflow-hidden ${sub.type === 'project' ? 'bg-purple-50/30 border-purple-200' : 'bg-white border-slate-200'}`}>
                                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-3 flex-wrap">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <h4 className="text-sm font-extrabold text-slate-800 truncate">{sub.company_name}</h4>
                                                {sub.type === 'project' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">Prosjekt</span>}
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">({visibleActs.length} / {subActs.length})</span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="checkbox" checked={filters.showInProgress} onChange={(e) => setSubFilters(prev => ({ ...prev, [sub.id]: { ...(prev[sub.id] || { showInProgress: true, showCompleted: false }), showInProgress: e.target.checked } }))} className="w-3 h-3 text-amber-600 border-slate-300 rounded focus:ring-amber-500" />
                                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Pågår</span>
                                                </label>
                                                <label className="flex items-center gap-1.5 cursor-pointer">
                                                    <input type="checkbox" checked={filters.showCompleted} onChange={(e) => setSubFilters(prev => ({ ...prev, [sub.id]: { ...(prev[sub.id] || { showInProgress: true, showCompleted: false }), showCompleted: e.target.checked } }))} className="w-3 h-3 text-green-600 border-slate-300 rounded focus:ring-green-500" />
                                                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Ferdige</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            {visibleActs.length === 0 ? (
                                                <p className="text-center py-6 text-slate-400 text-xs">Ingen aktiviteter å vise.</p>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                                                            <th className="text-left py-2 px-4">Aktivitet</th>
                                                            <th className="text-left py-2 px-4">Oppstart</th>
                                                            <th className="text-left py-2 px-4">Forventet ferdig</th>
                                                            <th className="text-left py-2 px-4">Frist</th>
                                                            <th className="text-left py-2 px-4">Status</th>
                                                            <th className="text-left py-2 w-20"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {visibleActs.map(act => {
                                                            const isEditing = editingId === act.id;
                                                            return (
                                                                <tr key={act.id} className={`transition-colors ${isEditing ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}>
                                                                    <td className="py-2 px-4">
                                                                        {isEditing ? (
                                                                            <input type="text" value={editData.name || ''} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                                                                        ) : (
                                                                            <span className="font-bold text-slate-800 cursor-pointer hover:text-primary-600 transition-colors" onClick={() => startEditing(act)}>
                                                                                {act.name}
                                                                            </span>
                                                                        )}
                                                                        {act.change_order_number && <span className="text-xs text-blue-600 ml-2">EM: {act.change_order_number}</span>}
                                                                    </td>
                                                                    <td className="py-2 px-4 text-slate-600 text-xs">
                                                                        {isEditing ? (
                                                                            <DatePickerWithWeek selected={editData.start_date ? new Date(editData.start_date) : null} onChange={(d) => setEditData({ ...editData, start_date: d ? d.toISOString().split('T')[0] : '' })} className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500/50" />
                                                                        ) : (
                                                                            <span className="cursor-pointer hover:text-primary-600 transition-colors" onClick={() => startEditing(act)}>
                                                                                {act.start_date ? new Date(act.start_date).toLocaleDateString('no-NO') : '—'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-4 text-slate-600 text-xs">
                                                                        {isEditing ? (
                                                                            <DatePickerWithWeek selected={editData.expected_end_date ? new Date(editData.expected_end_date) : null} onChange={(d) => setEditData({ ...editData, expected_end_date: d ? d.toISOString().split('T')[0] : '' })} className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500/50" />
                                                                        ) : (
                                                                            <span className="cursor-pointer hover:text-primary-600 transition-colors" onClick={() => startEditing(act)}>
                                                                                {act.expected_end_date ? new Date(act.expected_end_date).toLocaleDateString('no-NO') : '—'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-4 text-slate-600 text-xs">
                                                                        {isEditing ? (
                                                                            <DatePickerWithWeek selected={editData.deadline ? new Date(editData.deadline) : null} onChange={(d) => setEditData({ ...editData, deadline: d ? d.toISOString().split('T')[0] : '' })} className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-primary-500/50" />
                                                                        ) : (
                                                                            <span className="cursor-pointer hover:text-primary-600 transition-colors" onClick={() => startEditing(act)}>
                                                                                {act.deadline ? new Date(act.deadline).toLocaleDateString('no-NO') : '—'}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2 px-4">
                                                                        {isEditing ? (
                                                                            <select value={editData.status || 'planned'} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="bg-white border border-primary-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                                                                                <option value="planned">Planlagt</option>
                                                                                <option value="in_progress">Påbegynt</option>
                                                                                <option value="completed">Ferdig</option>
                                                                            </select>
                                                                        ) : (
                                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(act.status)}`} onClick={() => startEditing(act)}>
                                                                                {getStatusLabel(act.status)}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-2">
                                                                        {isEditing ? (
                                                                            <div className="flex items-center gap-1">
                                                                                <button onClick={saveEditing} disabled={saving || !editData.name} className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50" title="Lagre"><Check className="w-3.5 h-3.5" /></button>
                                                                                <button onClick={cancelEditing} className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200" title="Avbryt"><X className="w-3.5 h-3.5" /></button>
                                                                                <button onClick={() => deleteActivity(act.id)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100" title="Slett"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                            </div>
                                                                        ) : (
                                                                            <button onClick={() => startEditing(act)} className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="Rediger"><Pencil className="w-3.5 h-3.5" /></button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}

                                            {/* Plus button to add activity for this subcontractor */}
                                            <div className="border-t border-slate-100">
                                                {addFormSubId === sub.id ? (
                                                    <div className="p-3 bg-primary-50/40 border-t border-primary-100">
                                                        <div className="flex flex-wrap items-end gap-2">
                                                            <div className="flex-1 min-w-[180px]">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Aktivitetsnavn *</label>
                                                                <input
                                                                    type="text"
                                                                    value={addFormName}
                                                                    onChange={(e) => setAddFormName(e.target.value)}
                                                                    autoFocus
                                                                    className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                                    placeholder="F.eks. Puss av søyler"
                                                                />
                                                            </div>
                                                            <div className="w-36">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Startdato</label>
                                                                <DatePickerWithWeek
                                                                    selected={addFormStart ? new Date(addFormStart) : null}
                                                                    onChange={(d) => setAddFormStart(d ? d.toISOString().split('T')[0] : '')}
                                                                    className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary-500/50"
                                                                />
                                                            </div>
                                                            <div className="w-32">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</label>
                                                                <select
                                                                    value={addFormStatus}
                                                                    onChange={(e) => setAddFormStatus(e.target.value as any)}
                                                                    className="w-full bg-white border border-primary-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                                >
                                                                    <option value="planned">Planlagt</option>
                                                                    <option value="in_progress">Påbegynt</option>
                                                                    <option value="completed">Ferdig</option>
                                                                </select>
                                                            </div>
                                                            <button
                                                                onClick={() => handleQuickAddForSub(sub.id)}
                                                                disabled={addingForSub || !addFormName.trim()}
                                                                className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1"
                                                            >
                                                                {addingForSub ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                                Legg til
                                                            </button>
                                                            <button
                                                                onClick={closeAddForm}
                                                                className="px-2 py-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
                                                                title="Avbryt"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => openAddForm(sub.id)}
                                                        className="w-full py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-primary-600 hover:bg-primary-50/40 transition-colors"
                                                        title={`Legg til aktivitet for ${sub.company_name}`}
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Legg til aktivitet for {sub.company_name}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Miniature widget (collapsed) — shorter height
    const miniActivities = activities.filter(a => a.status !== 'completed');
    return (
        <div
            onClick={() => setExpanded(true)}
            className="bg-white rounded-3xl border border-slate-200/60 p-4 shadow-sm cursor-pointer hover:shadow-md hover:border-primary-300 transition-all flex flex-col min-h-[100px] h-full"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <div className="bg-blue-50 p-1.5 rounded-lg mr-2">
                        <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h3 className="text-xs font-extrabold text-slate-800">Aktiviteter</h3>
                </div>
                <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">Åpne →</span>
            </div>

            {loading ? (
                <div className="flex justify-center py-3"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div></div>
            ) : miniActivities.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-2">Ingen aktive aktiviteter</p>
            ) : (
                <div className="space-y-1 overflow-hidden flex-1">
                    {miniActivities.slice(0, 3).map(act => (
                        <div key={act.id} className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-700 truncate flex-1">{act.name}</span>
                            <span className={`ml-1.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 ${getStatusColor(act.status)}`}>
                                {getStatusLabel(act.status)}
                            </span>
                        </div>
                    ))}
                    {miniActivities.length > 3 && (
                        <p className="text-[9px] text-slate-400 text-center font-bold">+{miniActivities.length - 3} flere</p>
                    )}
                </div>
            )}
        </div>
    );
}
