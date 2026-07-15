import { useState, useEffect } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Users, Plus, Minus, Clock, Maximize2, X, Copy, Trash2, Settings, List, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import DatePickerWithWeek from './DatePickerWithWeek';

export default function ManpowerWidget({ selectedSubcontractorId: propSelectedSubcontractorId }: { selectedSubcontractorId?: string | null }) {
    const { selectedSubcontractorId: contextSelectedSubcontractorId, subcontractors } = useSubcontractor();
    const selectedSubcontractorId = propSelectedSubcontractorId ?? contextSelectedSubcontractorId;
    const [contractWorkers, setContractWorkers] = useState<number | string>('');
    const [billableWorkers, setBillableWorkers] = useState<number | string>('');
    const [totalWorkers, setTotalWorkers] = useState<number | string>('');
    const [hasLoggedToday, setHasLoggedToday] = useState(false);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Full popup state
    const [popDate, setPopDate] = useState('');
    const [popCW, setPopCW] = useState<number | string>('');
    const [popBW, setPopBW] = useState<number | string>('');
    const [popTotalWorkers, setPopTotalWorkers] = useState<number | string>('');
    const [popNotes, setPopNotes] = useState('');
    const [popBillableComment, setPopBillableComment] = useState('');
    const [activities, setActivities] = useState<any[]>([]);
    const [popActivities, setPopActivities] = useState<Array<{ activity_id: string; hours: string | number }>>([]);
    const [assignedAreas, setAssignedAreas] = useState<any[]>([]);
    const [popPositionIds, setPopPositionIds] = useState<string[]>([]);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [newActName, setNewActName] = useState('');
    const [newActDesc, setNewActDesc] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);

    // All-subcontractors view state
    const [allMode, setAllMode] = useState(false);
    const [loadingAll, setLoadingAll] = useState(false);
    const [savingSubId, setSavingSubId] = useState<string | null>(null);
    const [allModeDate, setAllModeDate] = useState('');
    const [manpowerBySub, setManpowerBySub] = useState<Record<string, { total: number | string; contract: number | string; billable: number | string; notes: string; hasLogged: boolean }>>({});

    // Per-subcontractor expand & billable-activities state (in the all-mode list)
    const [expandSubId, setExpandSubId] = useState<string | null>(null);
    const [activitiesByAllSub, setActivitiesByAllSub] = useState<Record<string, any[]>>({});
    const [billActsBySub, setBillActsBySub] = useState<Record<string, Array<{ activity_id: string; hours: string | number }>>>({});
    const [billCommentBySub, setBillCommentBySub] = useState<Record<string, string>>({});

    const todayStr = (() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    })();

    const getDefaultHours = (dateStr: string, workers: number): number => {
        if (workers <= 0) return 0;
        const date = new Date(dateStr);
        const dow = date.getDay();
        if (dow >= 1 && dow <= 4) return 8 * workers;
        if (dow === 5) return 5.5 * workers;
        return 0;
    };

    useEffect(() => {
        checkTodayLog();
        if (selectedSubcontractorId) {
            loadActivities();
            loadAreas();
        }
    }, [selectedSubcontractorId]);

    async function checkTodayLog() {
        if (!selectedSubcontractorId) { setLoading(false); return; }
        setLoading(true);
        const { data } = await supabase
            .from('daily_manpower').select('workers_count, contract_workers, billable_workers, notes')
            .eq('subcontractor_id', selectedSubcontractorId).eq('date', todayStr).maybeSingle();
        if (data) {
            setHasLoggedToday(true);
            setTotalWorkers(data.workers_count ?? '');
            setContractWorkers(data.contract_workers ?? '');
            setBillableWorkers(data.billable_workers ?? '');
            setNotes(data.notes ?? '');
        } else {
            setHasLoggedToday(false);
            setTotalWorkers('');
            setContractWorkers('');
            setBillableWorkers('');
            setNotes('');
        }
        setLoading(false);
    }

    async function loadActivities() {
        const { data } = await supabase.from('work_activities').select('*')
            .eq('subcontractor_id', selectedSubcontractorId).eq('is_active', true).order('name');
        if (data) setActivities(data);
    }

    const filteredActivities = showCompleted ? activities : activities.filter(a => a.status !== 'completed');

    async function loadAreas() {
        const { data } = await supabase.from('subcontractor_areas').select(`
            global_area_id, global_areas (id, building, floor, zone, description)
        `).eq('subcontractor_id', selectedSubcontractorId);
        if (data) {
            const areas = data.map((a: any) => a.global_areas).filter(Boolean)
                .sort((a: any, b: any) => (a.building || '').localeCompare(b.building || ''));
            setAssignedAreas(areas);
        }
    }

    async function handleSave() {
        if (!selectedSubcontractorId) return;
        const tw = Number(totalWorkers) || 0;
        const cw = Number(contractWorkers) || 0;
        const bw = Number(billableWorkers) || 0;
        // Allow logging 0 manpower
        setSaving(true);
        const payload = {
            subcontractor_id: selectedSubcontractorId, date: todayStr,
            workers_count: tw, contract_workers: cw, billable_workers: bw,
            is_contract_work: false, notes: notes, billable_comment: '',
            activity_id: null, hours_contract: 0, hours_billable: 0, billable_activities: []
        };
        if (hasLoggedToday) {
            await supabase.from('daily_manpower').update(payload).eq('subcontractor_id', selectedSubcontractorId).eq('date', todayStr);
        } else {
            await supabase.from('daily_manpower').insert([payload]);
        }
        setSaving(false);
        setHasLoggedToday(true);
    }

    async function handleFullSave() {
        if (!selectedSubcontractorId || !popDate) return;
        const tw = Number(popTotalWorkers) || 0;
        const cw = Number(popCW) || 0;
        const bw = Number(popBW) || 0;
        // Allow logging 0 manpower

        // Validate: if billable workers > 0, need either activities or comment
        // Billable activities are optional - workers can do both contract and billable work

        setSaving(true);
        const validActivities = popActivities.filter(a => a.activity_id);
        const payload = {
            subcontractor_id: selectedSubcontractorId, date: popDate,
            workers_count: tw, contract_workers: cw, billable_workers: bw,
            is_contract_work: cw > 0, notes: popNotes, billable_comment: popBillableComment,
            activity_id: validActivities.length === 1 ? validActivities[0].activity_id : null,
            hours_contract: 0,
            hours_billable: validActivities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0),
            billable_activities: validActivities
        };

        const { data: existing } = await supabase.from('daily_manpower')
            .select('id').eq('subcontractor_id', selectedSubcontractorId).eq('date', popDate).maybeSingle();

        let manpowerId: string;
        if (existing) {
            const { data } = await supabase.from('daily_manpower').update(payload).eq('id', existing.id).select();
            manpowerId = data?.[0]?.id || existing.id;
            // Delete existing positions
            await supabase.from('daily_manpower_positions').delete().eq('daily_manpower_id', manpowerId);
        } else {
            const { data } = await supabase.from('daily_manpower').insert([payload]).select();
            manpowerId = data?.[0]?.id;
        }

        // Handle positions
        if (manpowerId && popPositionIds.length > 0) {
            const inserts = popPositionIds.map(areaId => ({ daily_manpower_id: manpowerId, global_area_id: areaId }));
            await supabase.from('daily_manpower_positions').insert(inserts);
        }

        setSaving(false);
        setExpanded(false);
        checkTodayLog();
    }

    async function handleQuickAddActivity() {
        if (!newActName.trim() || !selectedSubcontractorId) return;
        const { data, error } = await supabase.from('work_activities').insert([{
            name: newActName.trim(), description: newActDesc.trim(),
            subcontractor_id: selectedSubcontractorId
        }]).select();
        if (!error && data) {
            setActivities([...activities, data[0]]);
            setPopActivities([...popActivities, { activity_id: data[0].id, hours: '' }]);
            setNewActName(''); setNewActDesc(''); setShowQuickAdd(false);
        }
    }

    function copyFromPreviousDay() {
        if (!popDate) return;
        const selectedTime = new Date(popDate).getTime();
        // We need to fetch logs for this subcontractor
        supabase.from('daily_manpower').select('*')
            .eq('subcontractor_id', selectedSubcontractorId)
            .order('date', { ascending: false }).limit(50)
            .then(({ data }) => {
                if (!data) return;
                const prev = data.find((l: any) => new Date(l.date).getTime() < selectedTime);
                if (!prev) { alert('Ingen tidligere logg funnet.'); return; }
                setPopTotalWorkers(prev.workers_count ?? '');
                setPopCW(prev.contract_workers ?? '');
                setPopBW(prev.billable_workers ?? '');
                setPopNotes(prev.notes || '');
                setPopBillableComment(prev.billable_comment || prev.comment || '');
                setPopActivities(prev.billable_activities || (prev.activity_id ? [{ activity_id: prev.activity_id, hours: prev.hours_billable }] : []));
            });
    }

    function openExpanded() {
        setPopDate(todayStr);
        setPopTotalWorkers(hasLoggedToday ? totalWorkers : '');
        setPopCW(hasLoggedToday ? contractWorkers : '');
        setPopBW(hasLoggedToday ? billableWorkers : '');
        setPopNotes(''); setPopBillableComment(''); setPopActivities([]); setPopPositionIds([]);
        setExpanded(true);
    }

    // Subcontractors first (alphabetical), then projects (alphabetical)
    const displaySubs = [...(subcontractors || [])].sort((a: any, b: any) => {
        const aIsProject = a.type === 'project' ? 1 : 0;
        const bIsProject = b.type === 'project' ? 1 : 0;
        if (aIsProject !== bIsProject) return aIsProject - bIsProject;
        return a.company_name.localeCompare(b.company_name, 'no');
    });

    async function loadAllModeData(dateStr: string) {
        setLoadingAll(true);
        const map: Record<string, { total: number | string; contract: number | string; billable: number | string; notes: string; hasLogged: boolean }> = {};
        displaySubs.forEach((s: any) => { map[s.id] = { total: '', contract: '', billable: '', notes: '', hasLogged: false }; });
        const { data } = await supabase
            .from('daily_manpower')
            .select('subcontractor_id, workers_count, contract_workers, billable_workers, notes')
            .eq('date', dateStr);
        if (data) {
            data.forEach((d: any) => {
                if (map[d.subcontractor_id]) {
                    map[d.subcontractor_id] = {
                        total: d.workers_count ?? '',
                        contract: d.contract_workers ?? '',
                        billable: d.billable_workers ?? '',
                        notes: d.notes ?? '',
                        hasLogged: true
                    };
                }
            });
        }
        setManpowerBySub(map);
        setLoadingAll(false);
    }

    async function openAllMode() {
        setAllModeDate(todayStr);
        await loadAllModeData(todayStr);
        setAllMode(true);
    }

    // Refetch when the date changes while the all-mode view is open
    useEffect(() => {
        if (allMode && allModeDate) {
            loadAllModeData(allModeDate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allModeDate]);

    function updateSubField(subId: string, field: 'total' | 'contract' | 'billable' | 'notes', value: number | string) {
        setManpowerBySub((prev) => ({ ...prev, [subId]: { ...prev[subId], [field]: value } }));
    }

    async function saveForSub(subId: string) {
        const st = manpowerBySub[subId];
        if (!st) return;
        const tw = Number(st.total) || 0;
        // Allow logging 0 manpower
        setSavingSubId(subId);
        // Build billable activities payload if any are set
        const billActs = (billActsBySub[subId] || []).filter(a => a.activity_id);
        const billHours = billActs.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
        const billComment = billCommentBySub[subId] || '';
        const payload: any = {
            subcontractor_id: subId, date: allModeDate,
            workers_count: tw, contract_workers: Number(st.contract) || 0, billable_workers: Number(st.billable) || 0,
            is_contract_work: false, notes: st.notes || '', billable_comment: billComment,
            activity_id: billActs.length === 1 ? billActs[0].activity_id : null,
            hours_contract: 0,
            hours_billable: billHours,
            billable_activities: billActs
        };
        const { data: existing } = await supabase
            .from('daily_manpower').select('id').eq('subcontractor_id', subId).eq('date', allModeDate).maybeSingle();
        let manpowerId: string;
        if (existing) {
            const { data } = await supabase.from('daily_manpower').update(payload).eq('id', existing.id).select();
            manpowerId = data?.[0]?.id || existing.id;
            await supabase.from('daily_manpower_positions').delete().eq('daily_manpower_id', manpowerId);
        } else {
            const { data } = await supabase.from('daily_manpower').insert([payload]).select();
            manpowerId = data?.[0]?.id || '';
        }
        setManpowerBySub((prev) => ({ ...prev, [subId]: { ...prev[subId], hasLogged: true } }));
        setSavingSubId(null);
    }

    // Load activities for a sub when it's expanded, and preload existing billable activities from the manpower log
    async function expandSubForBillable(subId: string) {
        setExpandSubId(subId);
        if (!activitiesByAllSub[subId]) {
            const { data } = await supabase
                .from('work_activities')
                .select('*')
                .eq('subcontractor_id', subId)
                .eq('is_active', true)
                .order('name');
            setActivitiesByAllSub(prev => ({ ...prev, [subId]: data || [] }));
        }
        // If we haven't preloaded billable activities for this sub+date, do it now
        if (!billActsBySub[subId]) {
            const { data: log } = await supabase
                .from('daily_manpower')
                .select('billable_activities, billable_comment')
                .eq('subcontractor_id', subId)
                .eq('date', allModeDate)
                .maybeSingle();
            if (log) {
                const acts = log.billable_activities && log.billable_activities.length > 0
                    ? log.billable_activities
                    : [];
                setBillActsBySub(prev => ({ ...prev, [subId]: acts }));
                setBillCommentBySub(prev => ({ ...prev, [subId]: log.billable_comment || '' }));
            } else {
                setBillActsBySub(prev => ({ ...prev, [subId]: [] }));
                setBillCommentBySub(prev => ({ ...prev, [subId]: '' }));
            }
        }
    }

    function updateSubBillActs(subId: string, acts: Array<{ activity_id: string; hours: string | number }>) {
        setBillActsBySub(prev => ({ ...prev, [subId]: acts }));
    }

    function updateSubBillComment(subId: string, comment: string) {
        setBillCommentBySub(prev => ({ ...prev, [subId]: comment }));
    }

    const now = new Date();
    const isPast14 = now.getHours() >= 14;
    const showWarning = isPast14 && !hasLoggedToday && selectedSubcontractorId;

    if (expanded) {
        const tw = Number(popTotalWorkers) || 0;
        const cw = Number(popCW) || 0;
        const bw = Number(popBW) || 0;
        const validActs = popActivities.filter(a => a.activity_id);
        const totalHours = validActs.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
        const expectedHours = getDefaultHours(popDate, bw);
        const needsComment = bw > 0 && validActs.length === 0;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                        <h3 className="text-lg font-extrabold text-slate-800">Loggfør Mannskap</h3>
                        <button onClick={() => setExpanded(false)} className="text-slate-400 hover:text-red-500 p-1"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto">
                        {/* Date */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Dato</label>
                            <DatePickerWithWeek selected={popDate ? new Date(popDate) : null}
                                onChange={(d) => setPopDate(d ? d.toISOString().split('T')[0] : '')}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50" required />
                        </div>

                        {/* Copy button */}
                        <button type="button" onClick={copyFromPreviousDay}
                            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 hover:border-slate-300">
                            <Copy className="w-3.5 h-3.5 text-slate-500" /> Kopier data fra forrige registrerte dag
                        </button>

                        {/* Activities for billable work */}
                        {bw > 0 && (
                            <div className="space-y-3 pt-3 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktiviteter for regningsarbeid</label>
                                    <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} className="w-3 h-3 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                                            <span className="text-[10px] font-bold text-slate-500">Ferdige</span>
                                        </label>
                                        <button type="button" onClick={() => setShowQuickAdd(!showQuickAdd)} className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center p-1">
                                            <Plus className="w-4 h-4 mr-1" /> Ny aktivitet
                                        </button>
                                    </div>
                                </div>
                                {showQuickAdd && (
                                    <div className="bg-primary-50 p-3 rounded-xl border border-primary-200 space-y-2">
                                        <input type="text" value={newActName} onChange={(e) => setNewActName(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Navn på aktivitet *" />
                                        <input type="text" value={newActDesc} onChange={(e) => setNewActDesc(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50" placeholder="Beskrivelse (valgfritt)" />
                                        <div className="flex gap-2">
                                            <button onClick={handleQuickAddActivity} disabled={!newActName.trim()} className="flex-1 px-3 py-2 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50">Opprett</button>
                                            <button onClick={() => { setShowQuickAdd(false); setNewActName(''); setNewActDesc(''); }} className="px-3 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300">Avbryt</button>
                                        </div>
                                    </div>
                                )}
                                {popActivities.map((act, idx) => (
                                    <div key={idx} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-200">
                                        <div className="flex-1">
                                            <select value={act.activity_id} onChange={(e) => { const na = [...popActivities]; na[idx].activity_id = e.target.value; setPopActivities(na); }}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                                                <option value="">Velg aktivitet...</option>
                                                {filteredActivities.map(a => <option key={a.id} value={a.id}>{a.name}{a.change_order_number ? ` (${a.change_order_number})` : ''}</option>)}
                                            </select>
                                        </div>
                                        <div className="w-20 relative">
                                            <input type="number" min="0" step="0.5" value={act.hours}
                                                onChange={(e) => { const na = [...popActivities]; na[idx].hours = e.target.value === '' ? '' : Number(e.target.value); setPopActivities(na); }}
                                                className="w-full bg-white border border-amber-300 rounded-lg px-2 py-2 text-sm font-extrabold text-amber-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-6" placeholder="0" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-sm pointer-events-none">t</span>
                                        </div>
                                        <button type="button" onClick={() => setPopActivities(popActivities.filter((_, i) => i !== idx))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setPopActivities([...popActivities, { activity_id: '', hours: '' }])}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center text-xs bg-white">
                                    <Plus className="w-4 h-4 mr-2" /> Legg til ny regningsaktivitet
                                </button>
                                <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
                                    Forventet: {expectedHours}t | Totalt utfylt: {totalHours}t
                                </p>
                            </div>
                        )}

                        {/* Workers */}
                        <div className="space-y-3">
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
                                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Totalt antall arbeidere</label>
                                <div className="flex items-center justify-between gap-4">
                                    <button type="button" onClick={() => setPopTotalWorkers(Math.max(0, (Number(popTotalWorkers) || 0) - 1))} className="w-14 h-14 shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 shadow-sm"><Minus className="w-6 h-6" /></button>
                                    <input type="number" min="0" value={popTotalWorkers} onChange={(e) => setPopTotalWorkers(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-2 py-3 text-3xl font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-inner" placeholder="0" />
                                    <button type="button" onClick={() => setPopTotalWorkers((Number(popTotalWorkers) || 0) + 1)} className="w-14 h-14 shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 shadow-sm"><Plus className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4">
                                <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Kontraktsarbeidere</label>
                                <div className="flex items-center justify-between gap-4">
                                    <button type="button" onClick={() => setPopCW(Math.max(0, (Number(popCW) || 0) - 1))} className="w-14 h-14 shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 shadow-sm"><Minus className="w-6 h-6" /></button>
                                    <input type="number" min="0" value={popCW} onChange={(e) => setPopCW(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full bg-white border border-slate-200 rounded-2xl px-2 py-3 text-3xl font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-500/50 shadow-inner" placeholder="0" />
                                    <button type="button" onClick={() => setPopCW((Number(popCW) || 0) + 1)} className="w-14 h-14 shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 shadow-sm"><Plus className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-4">
                                <label className="block text-sm font-bold text-amber-700/70 uppercase tracking-widest mb-3 text-center">Regningsarbeidere</label>
                                <div className="flex items-center justify-between gap-4">
                                    <button type="button" onClick={() => setPopBW(Math.max(0, (Number(popBW) || 0) - 1))} className="w-14 h-14 shrink-0 bg-white border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-95 shadow-sm"><Minus className="w-6 h-6" /></button>
                                    <input type="number" min="0" value={popBW} onChange={(e) => setPopBW(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full bg-white border border-amber-200 rounded-2xl px-2 py-3 text-3xl font-black text-amber-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-inner" placeholder="0" />
                                    <button type="button" onClick={() => setPopBW((Number(popBW) || 0) + 1)} className="w-14 h-14 shrink-0 bg-white border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600 hover:bg-amber-50 active:scale-95 shadow-sm"><Plus className="w-6 h-6" /></button>
                                </div>
                            </div>
                        </div>

                        {/* Positions */}
                        {assignedAreas.length > 0 && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Posisjoner/Områder (valgfritt)</label>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2">
                                    {assignedAreas.map((area: any) => (
                                        <label key={area.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors">
                                            <input type="checkbox" checked={popPositionIds.includes(area.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setPopPositionIds([...popPositionIds, area.id]);
                                                    else setPopPositionIds(popPositionIds.filter(id => id !== area.id));
                                                }}
                                                className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                                            <span className="text-sm text-slate-700">{area.building}{area.floor ? ` - ${area.floor}` : ''}{area.zone ? ` - ${area.zone}` : ''}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Summary */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-sm font-bold text-slate-700">Totalt antall arbeidere i dag:</span>
                                <span className="text-xl font-extrabold text-primary-600">{tw}</span>
                            </div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-sm font-bold text-slate-700">Regningstimer:</span>
                                <span className="text-xl font-extrabold text-amber-600">{totalHours}</span>
                            </div>
                            {tw > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Kommentar for regningsarbeid {needsComment && <span className="text-red-500">*</span>}
                                    </label>
                                    <textarea rows={2} required={needsComment} value={popBillableComment}
                                        onChange={(e) => setPopBillableComment(e.target.value)}
                                        className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-slate-400"
                                        placeholder={validActs.length > 0 ? "Valgfri kommentar (aktiviteter er valgt)" : "Gjelder regningsarbeid for... (Kreves når arbeidere er registrert på regning uten aktivitet)"} />
                                    {validActs.length > 0 && <p className="text-[10px] text-slate-500 mt-1">Kommentar er valgfri når aktiviteter er valgt.</p>}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Notater (valgfritt)</label>
                            <textarea rows={2} value={popNotes} onChange={(e) => setPopNotes(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 placeholder:text-slate-400"
                                placeholder="Skriv inn notater for skiftet..." />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setExpanded(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">Avbryt</button>
                            <button onClick={handleFullSave} disabled={saving}
                                className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Lagre Logg'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (allMode) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-extrabold text-slate-800">Loggfør mannskap — alle</h3>
                            <button onClick={() => setAllMode(false)} className="text-slate-400 hover:text-red-500 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => {
                                if (!allModeDate) return;
                                const d = new Date(allModeDate + 'T00:00:00');
                                d.setDate(d.getDate() - 1);
                                setAllModeDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                            }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors shrink-0" title="Forrige dag">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <DatePickerWithWeek
                                selected={allModeDate ? new Date(allModeDate + 'T00:00:00') : null}
                                onChange={(d) => setAllModeDate(d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '')}
                                className="!w-auto bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 min-w-0"
                            />
                            <button type="button" onClick={() => {
                                if (!allModeDate) return;
                                const d = new Date(allModeDate + 'T00:00:00');
                                d.setDate(d.getDate() + 1);
                                setAllModeDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                            }} className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors shrink-0" title="Neste dag">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-3 overflow-y-auto">
                        {loadingAll ? (
                            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
                        ) : displaySubs.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-6">Ingen underentreprenører.</p>
                        ) : (
                            displaySubs.map((sub: any) => {
                                const st = manpowerBySub[sub.id] || { total: '', contract: '', billable: '', notes: '', hasLogged: false };
                                const tw = Number(st.total) || 0;
                                return (
                                    <div key={sub.id} className={`rounded-2xl border p-3 ${sub.type === 'project' ? 'bg-purple-50/40 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-2 mb-2 min-w-0">
                                            <span className="font-bold text-slate-800 text-sm truncate flex-1">{sub.company_name}</span>
                                            {sub.type === 'project' && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">Prosjekt</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1 flex-1">
                                                <button type="button" onClick={() => updateSubField(sub.id, 'total', Math.max(0, (Number(st.total) || 0) - 1))} className="w-5 h-5 shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                                                <div className="flex flex-col items-center flex-1"><span className="text-[8px] font-bold text-primary-600 uppercase">Tot</span><input type="number" min="0" value={st.total} onChange={(e) => updateSubField(sub.id, 'total', e.target.value === '' ? '' : Number(e.target.value))} className="w-10 text-center text-sm font-black text-slate-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                                                <button type="button" onClick={() => updateSubField(sub.id, 'total', (Number(st.total) || 0) + 1)} className="w-5 h-5 shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                                            </div>
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-1 flex-1">
                                                <button type="button" onClick={() => updateSubField(sub.id, 'contract', Math.max(0, (Number(st.contract) || 0) - 1))} className="w-5 h-5 shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                                                <div className="flex flex-col items-center flex-1"><span className="text-[8px] font-bold text-primary-600 uppercase">K</span><input type="number" min="0" value={st.contract} onChange={(e) => updateSubField(sub.id, 'contract', e.target.value === '' ? '' : Number(e.target.value))} className="w-7 text-center text-sm font-black text-slate-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                                                <button type="button" onClick={() => updateSubField(sub.id, 'contract', (Number(st.contract) || 0) + 1)} className="w-5 h-5 shrink-0 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                                            </div>
                                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-1 flex-1">
                                                <button type="button" onClick={() => updateSubField(sub.id, 'billable', Math.max(0, (Number(st.billable) || 0) - 1))} className="w-5 h-5 shrink-0 bg-white border border-amber-200 rounded flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                                                <div className="flex flex-col items-center flex-1"><span className="text-[8px] font-bold text-amber-600 uppercase">R</span><input type="number" min="0" value={st.billable} onChange={(e) => updateSubField(sub.id, 'billable', e.target.value === '' ? '' : Number(e.target.value))} className="w-7 text-center text-sm font-black text-amber-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                                                <button type="button" onClick={() => updateSubField(sub.id, 'billable', (Number(st.billable) || 0) + 1)} className="w-5 h-5 shrink-0 bg-white border border-amber-200 rounded flex items-center justify-center text-amber-600 hover:bg-amber-50 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                                            </div>
                                        </div>
                                        <input type="text" value={st.notes} onChange={(e) => updateSubField(sub.id, 'notes', e.target.value)} placeholder="Kommentar (valgfritt)..." className="w-full mt-2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 placeholder:text-slate-400" />
                                        <div className="flex gap-1.5 mt-2">
                                            <button onClick={() => saveForSub(sub.id)} disabled={savingSubId === sub.id}
                                                className="flex-1 py-1.5 bg-primary-600 text-white font-bold text-[11px] rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                                                {savingSubId === sub.id ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : st.hasLogged ? 'Oppdater' : 'Loggfør'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (expandSubId === sub.id) {
                                                        setExpandSubId(null);
                                                    } else {
                                                        expandSubForBillable(sub.id);
                                                    }
                                                }}
                                                className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                                                    expandSubId === sub.id
                                                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700 border border-slate-200'
                                                }`}
                                                title={expandSubId === sub.id ? 'Skjul regningsaktiviteter' : 'Utvid for å legge til regningsaktiviteter'}
                                            >
                                                {expandSubId === sub.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                Aktiviteter
                                            </button>
                                        </div>

                                        {/* Expanded billable activities section */}
                                        {expandSubId === sub.id && (
                                            <div className="mt-2 p-2 bg-amber-50/40 border border-amber-200 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Regningsaktiviteter for {sub.company_name}</span>
                                                    <span className="text-[9px] font-bold text-amber-600">{(billActsBySub[sub.id] || []).filter(a => a.activity_id).length} valgt</span>
                                                </div>
                                                {(() => {
                                                    const acts = billActsBySub[sub.id] || [];
                                                    const subActs = activitiesByAllSub[sub.id] || [];
                                                    const filteredActs = subActs.filter(a => a.status !== 'completed');
                                                    if (acts.length === 0) {
                                                        return (
                                                            <p className="text-[10px] text-slate-500 italic">Ingen aktiviteter lagt til enda.</p>
                                                        );
                                                    }
                                                    return acts.map((act, idx) => (
                                                        <div key={idx} className="flex gap-1 items-start">
                                                            <select value={act.activity_id} onChange={(e) => {
                                                                const na = [...acts];
                                                                na[idx] = { ...na[idx], activity_id: e.target.value };
                                                                updateSubBillActs(sub.id, na);
                                                            }} className="flex-1 bg-white border border-amber-200 rounded px-1.5 py-1 text-[10px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                                                                <option value="">Velg aktivitet...</option>
                                                                {filteredActs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                            </select>
                                                            <div className="w-16 relative">
                                                                <input type="number" min="0" step="0.5" value={act.hours} onChange={(e) => {
                                                                    const na = [...acts];
                                                                    na[idx] = { ...na[idx], hours: e.target.value === '' ? '' : Number(e.target.value) };
                                                                    updateSubBillActs(sub.id, na);
                                                                }} className="w-full bg-white border border-amber-200 rounded px-1 py-1 text-[10px] font-bold text-amber-900 text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-4" placeholder="0" />
                                                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-[10px] pointer-events-none">t</span>
                                                            </div>
                                                            <button type="button" onClick={() => updateSubBillActs(sub.id, acts.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    ));
                                                })()}
                                                <button type="button" onClick={() => updateSubBillActs(sub.id, [...(billActsBySub[sub.id] || []), { activity_id: '', hours: '' }])} className="w-full py-1.5 border border-dashed border-amber-200 rounded-lg text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:border-amber-300 transition-colors flex items-center justify-center gap-1 bg-white">
                                                    <Plus className="w-3 h-3" /> Legg til regningsaktivitet
                                                </button>
                                                <textarea
                                                    rows={1}
                                                    value={billCommentBySub[sub.id] || ''}
                                                    onChange={(e) => updateSubBillComment(sub.id, e.target.value)}
                                                    placeholder="Kommentar for regningsarbeid (valgfritt)..."
                                                    className="w-full bg-white border border-amber-200 rounded px-2 py-1 text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder:text-slate-400 resize-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Compact widget
    return (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                    <div className="bg-primary-50 p-1.5 rounded-lg mr-2"><Users className="w-3.5 h-3.5 text-primary-600" /></div>
                    <h3 className="text-xs font-extrabold text-slate-800">Bemanning</h3>
                </div>
                <div className="flex items-center gap-1">
                    {showWarning && <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200"><Clock className="w-3 h-3 animate-pulse" /><span className="text-[9px] font-bold">14:00!</span></div>}
                    <button onClick={openAllMode} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Alle underentreprenører"><List className="w-3.5 h-3.5" /></button>
                    <button onClick={openExpanded} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Utvid"><Maximize2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>

                    {/* Quick copy from previous day — opens expanded popup with full data */}
                    {selectedSubcontractorId && !loading && (
                        <button
                            type="button"
                            onClick={async () => {
                                if (!selectedSubcontractorId) return;
                                const prevDate = new Date();
                                prevDate.setDate(prevDate.getDate() - 1);
                                const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
                                const { data } = await supabase.from('daily_manpower')
                                    .select('*')
                                    .eq('subcontractor_id', selectedSubcontractorId)
                                    .eq('date', prevDateStr)
                                    .maybeSingle();
                                if (data) {
                                    // Open expanded popup pre-filled with yesterday's full data
                                    setPopDate(todayStr);
                                    setPopTotalWorkers(Number(data.workers_count) || 0);
                                    setPopCW(Number(data.contract_workers) || 0);
                                    setPopBW(Number(data.billable_workers) || 0);
                                    setPopNotes(data.notes || '');
                                    setPopBillableComment(data.billable_comment || data.comment || '');
                                    setPopActivities(
                                        data.billable_activities && data.billable_activities.length > 0
                                            ? data.billable_activities
                                            : (data.activity_id ? [{ activity_id: data.activity_id, hours: data.hours_billable }] : [])
                                    );
                                    setPopPositionIds([]);
                                    setExpanded(true);
                                    loadActivities();
                                } else {
                                    alert('Ingen bemanning logget for i går.');
                                }
                            }}
                            className="w-full mb-2 py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 hover:border-slate-300"
                        >
                            <Copy className="w-3 h-3 text-slate-400" /> Kopier fra i går
                        </button>
                    )}
            {!selectedSubcontractorId ? (
                <p className="text-[10px] text-slate-400 text-center py-2">Velg UE</p>
            ) : loading ? (
                <div className="flex justify-center py-3"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div></div>
            ) : (
                <>
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-200 mb-2">
                            <button type="button" onClick={() => setTotalWorkers(Math.max(0, (Number(totalWorkers) || 0) - 1))} className="w-5 h-5 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-primary-600 uppercase">Tot</span><input type="number" min="0" value={totalWorkers} onChange={(e) => setTotalWorkers(e.target.value === '' ? '' : Number(e.target.value))} className="w-10 text-center text-base font-black text-slate-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                            <button type="button" onClick={() => setTotalWorkers((Number(totalWorkers) || 0) + 1)} className="w-5 h-5 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-200 mb-2">
                            <button type="button" onClick={() => setContractWorkers(Math.max(0, (Number(contractWorkers) || 0) - 1))} className="w-5 h-5 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-primary-600 uppercase">K</span><input type="number" min="0" value={contractWorkers} onChange={(e) => setContractWorkers(e.target.value === '' ? '' : Number(e.target.value))} className="w-7 text-center text-base font-black text-slate-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                            <button type="button" onClick={() => setContractWorkers((Number(contractWorkers) || 0) + 1)} className="w-5 h-5 shrink-0 bg-white border border-slate-200 rounded flex items-center justify-center text-primary-500 hover:bg-primary-50 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                        </div>
                        <div className="flex items-center justify-between bg-amber-50/50 rounded-lg px-2 py-1.5 border border-amber-200/60">
                            <button type="button" onClick={() => setBillableWorkers(Math.max(0, (Number(billableWorkers) || 0) - 1))} className="w-5 h-5 shrink-0 bg-white border border-amber-200 rounded flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-95 transition-all"><Minus className="w-2.5 h-2.5" /></button>
                            <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-amber-600 uppercase">R</span><input type="number" min="0" value={billableWorkers} onChange={(e) => setBillableWorkers(e.target.value === '' ? '' : Number(e.target.value))} className="w-7 text-center text-base font-black text-amber-900 bg-transparent border-none focus:outline-none p-0" placeholder="0" /></div>
                            <button type="button" onClick={() => setBillableWorkers((Number(billableWorkers) || 0) + 1)} className="w-5 h-5 shrink-0 bg-white border border-amber-200 rounded flex items-center justify-center text-amber-600 hover:bg-amber-100 active:scale-95 transition-all"><Plus className="w-2.5 h-2.5" /></button>
                        </div>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kommentar (valgfritt)..." className="w-full mb-2 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500/50 placeholder:text-slate-400" />
                    <button onClick={handleSave} disabled={saving}
                        className="w-full py-2 bg-primary-600 text-white font-bold text-xs rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1">
                        {saving ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : hasLoggedToday ? 'Oppdater' : <><Plus className="w-3 h-3" /> Loggfør</>}
                    </button>
                </>
            )}
        </div>
    );
}
