import { useEffect, useState, useRef, Fragment } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Users, Plus, X, Edit2, Trash2, ChevronLeft, ChevronRight, Clock, Settings, ClipboardList, Minus, Check, Copy, Repeat } from 'lucide-react';
import DatePickerWithWeek from '../components/DatePickerWithWeek';

export default function Bemanning() {
    const { selectedSubcontractorId, setSelectedSubcontractorId, subcontractors } = useSubcontractor();
    const [manpower, setManpower] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showManpowerModal, setShowManpowerModal] = useState(false);
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [newActivityName, setNewActivityName] = useState('');
    const [newActivityDesc, setNewActivityDesc] = useState('');
    const [newActivityChangeOrder, setNewActivityChangeOrder] = useState('');
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [editActivityName, setEditActivityName] = useState('');
    const [editActivityDesc, setEditActivityDesc] = useState('');
    const [editActivityChangeOrder, setEditActivityChangeOrder] = useState('');
    const [showQuickAddActivity, setShowQuickAddActivity] = useState(false);
    const [hideCompletedActivities, setHideCompletedActivities] = useState(true);

    // Drag & drop / Excel-like fill state for the calendar grids
    const [dragSource, setDragSource] = useState<{ dateStr: string; logId: string } | null>(null);
    const [isFilling, setIsFilling] = useState(false);
    const [fillSource, setFillSource] = useState<any | null>(null);
    const [fillTargets, setFillTargets] = useState<string[]>([]);
    const manpowerRef = useRef<any[]>([]);
    useEffect(() => { manpowerRef.current = manpower; }, [manpower]);

    // ---- Multi-select subcontractors for the miniature overview ----
    const [selectedSubIds, setSelectedSubIds] = useState<string[]>(() => selectedSubcontractorId ? [selectedSubcontractorId] : []);
    const [manpowerBySub, setManpowerBySub] = useState<Record<string, any[]>>({});
    const [showSubDropdown, setShowSubDropdown] = useState(false);
    const [hoveredSubId, setHoveredSubId] = useState<string | null>(null);
    const [expandedViewModes, setExpandedViewModes] = useState<Record<string, 'week' | 'month'>>({});

    const refreshManpowerMulti = async () => {
        if (selectedSubIds.length === 0) { setManpowerBySub({}); return; }
        const { data } = await supabase
            .from('daily_manpower')
            .select(`*, daily_manpower_positions ( global_area_id )`)
            .in('subcontractor_id', selectedSubIds)
            .order('date', { ascending: false })
            .limit(200);
        if (data) {
            const map: Record<string, any[]> = {};
            selectedSubIds.forEach(id => { map[id] = []; });
            data.forEach(d => { if (!map[d.subcontractor_id]) map[d.subcontractor_id] = []; map[d.subcontractor_id].push(d); });
            setManpowerBySub(map);
        }
    };

    useEffect(() => {
        refreshManpowerMulti();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSubIds]);

    // Sync the context's active subcontractor with the multi-selection
    useEffect(() => {
        if (selectedSubIds.length === 1) {
            if (selectedSubcontractorId !== selectedSubIds[0]) setSelectedSubcontractorId(selectedSubIds[0]);
        } else if (selectedSubIds.length === 0) {
            if (selectedSubcontractorId !== null) setSelectedSubcontractorId(null);
        }
        // length > 1: leave context untouched so the miniature overview stays the focus
    }, [selectedSubIds]);

    // Calendar State
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const now = new Date();
        const day = now.getDay() || 7; // Convert Sun (0) to 7
        now.setHours(0, 0, 0, 0);
        return new Date(now.getTime() - (day - 1) * 24 * 60 * 60 * 1000); // Monday
    });

    const [currentMonthStart, setCurrentMonthStart] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const [newManpower, setNewManpower] = useState<{
        id?: string;
        date: string;
        contract_workers: number | string;
        billable_workers: number | string;
        total_workers_per_day?: number | string;
        notes: string;
        billable_comment: string;
        billable_activities: Array<{ activity_id: string, hours: string | number }>;
        position_ids: string[];
    }>({
        date: (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })(),
        contract_workers: '',
        billable_workers: '',
        total_workers_per_day: '',
        notes: '',
        billable_comment: '',
        billable_activities: [],
        position_ids: []
    });

    const [assignedAreas, setAssignedAreas] = useState<any[]>([]);

    // Filter activities: hide completed by default
    const filteredActivitiesForDropdown = hideCompletedActivities
        ? activities.filter(a => a.status !== 'completed')
        : activities;

    const resetForm = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        setNewManpower({
            date: dateStr,
            contract_workers: '',
            billable_workers: '',
            total_workers_per_day: '',
            notes: '',
            billable_comment: '',
            billable_activities: [],
            position_ids: []
        });
    };

    const handleCopyPreviousDay = () => {
        if (!newManpower.date) return;

        const selectedTime = new Date(newManpower.date).getTime();
        const previousLog = manpower
            .filter((log: any) => new Date(log.date).getTime() < selectedTime)
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (!previousLog) {
            alert('Ingen tidligere logg funnet å kopiere fra.');
            return;
        }

        const positionIds = previousLog.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];

        setNewManpower({
            ...newManpower,
            contract_workers: previousLog.contract_workers ?? '',
            billable_workers: previousLog.billable_workers ?? '',
            total_workers_per_day: previousLog.total_workers_per_day ?? '',
            notes: previousLog.notes || '',
            billable_comment: previousLog.billable_comment || previousLog.comment || '',
            billable_activities: previousLog.billable_activities || (previousLog.activity_id ? [{ activity_id: previousLog.activity_id, hours: previousLog.hours_billable }] : []),
            position_ids: positionIds
        });
    };

    const handleCopyFromPreviousDay = (targetDateStr: string) => {
        const targetDate = new Date(targetDateStr);
        const previousDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
        const previousDateStr = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}-${String(previousDate.getDate()).padStart(2, '0')}`;

        const previousLog = manpower.find((log: any) => log.date === previousDateStr);

        if (!previousLog) {
            alert('Ingen bemanning funnet for forrige dag.');
            return null;
        }

        const positionIds = previousLog.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];

        const result = {
            date: targetDateStr,
            contract_workers: previousLog.contract_workers ?? '',
            billable_workers: previousLog.billable_workers ?? '',
            notes: previousLog.notes || '',
            billable_comment: previousLog.billable_comment || previousLog.comment || '',
            billable_activities: previousLog.billable_activities || (previousLog.activity_id ? [{ activity_id: previousLog.activity_id, hours: previousLog.hours_billable }] : []),
            position_ids: positionIds
        };

        return result;
    };

    // Repeat entry: copy an existing day's data to the next day and open modal
    const handleRepeatEntry = (sourceDateStr: string) => {
        const sourceLog = manpower.find((log: any) => log.date === sourceDateStr);
        if (!sourceLog) return;

        const nextDate = new Date(sourceDateStr + 'T00:00:00');
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

        const positionIds = sourceLog.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];

        setNewManpower({
            date: nextDateStr,
            contract_workers: sourceLog.contract_workers ?? '',
            billable_workers: sourceLog.billable_workers ?? '',
            total_workers_per_day: sourceLog.total_workers_per_day ?? '',
            notes: sourceLog.notes || '',
            billable_comment: sourceLog.billable_comment || sourceLog.comment || '',
            billable_activities: sourceLog.billable_activities || (sourceLog.activity_id ? [{ activity_id: sourceLog.activity_id, hours: sourceLog.hours_billable }] : []),
            position_ids: positionIds
        });
        setShowManpowerModal(true);
    };

    // ---- Drag & drop + Excel-like fill for the calendar grids ----
    async function refreshManpower() {
        if (!selectedSubcontractorId) return;
        setLoading(true);
        const { data: mData } = await supabase
            .from('daily_manpower')
            .select(`*, daily_manpower_positions ( global_area_id )`)
            .eq('subcontractor_id', selectedSubcontractorId)
            .order('date', { ascending: false })
            .limit(100);
        if (mData) setManpower(mData);
        setLoading(false);
    }

    const moveManpower = async (sourceLogId: string, targetDateStr: string) => {
        if (!selectedSubcontractorId) return;
        const source = manpowerRef.current.find(m => m.id === sourceLogId);
        if (!source || source.date === targetDateStr) return;
        const { error } = await supabase.from('daily_manpower').update({ date: targetDateStr }).eq('id', sourceLogId);
        if (!error) {
            await refreshManpower();
        } else {
            alert('Kunne ikke flytte mannskapslogg.');
        }
    };

    const startFill = (e: React.MouseEvent, sourceLog: any) => {
        e.preventDefault();
        e.stopPropagation();
        setFillSource(sourceLog);
        setFillTargets([sourceLog.date]);
        setIsFilling(true);
    };

    const extendFill = (dateStr: string) => {
        if (!isFilling || !fillSource) return;
        setFillTargets(prev => prev.includes(dateStr) ? prev : [...prev, dateStr]);
    };

    const finishFill = async () => {
        if (!isFilling || !fillSource) {
            setIsFilling(false); setFillSource(null); setFillTargets([]);
            return;
        }
        const source = fillSource;
        const targets = fillTargets.filter(d => d !== source.date);
        setIsFilling(false);
        setFillSource(null);
        setFillTargets([]);
        if (targets.length === 0) return;
        for (const targetDate of targets) {
            const existing = manpowerRef.current.find(m => m.date === targetDate);
            const payload = {
                subcontractor_id: selectedSubcontractorId,
                date: targetDate,
                workers_count: source.workers_count,
                contract_workers: source.contract_workers || 0,
                billable_workers: source.billable_workers || 0,
                is_contract_work: Number(source.contract_workers) > 0,
                notes: source.notes || '',
                billable_comment: source.billable_comment || source.comment || '',
                activity_id: null,
                hours_contract: 0,
                hours_billable: 0,
                billable_activities: source.billable_activities || []
            };
            if (existing) {
                await supabase.from('daily_manpower').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('daily_manpower').insert([payload]);
            }
        }
        await refreshManpower();
    };

    useEffect(() => {
        const onUp = () => { if (isFilling) finishFill(); };
        window.addEventListener('mouseup', onUp);
        return () => window.removeEventListener('mouseup', onUp);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFilling, fillSource, fillTargets]);

    // Calculate default hours based on day of week
    const getDefaultHours = (dateStr: string, workers: number): number => {
        if (workers <= 0) return 0;
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        // Monday-Thursday: 8 hours, Friday: 5.5 hours
        if (dayOfWeek >= 1 && dayOfWeek <= 4) return 8 * workers; // Mon-Thu
        if (dayOfWeek === 5) return 5.5 * workers; // Friday
        return 0; // Weekend
    };

    // Standalone loadActivities — reusable so we can refresh when the modal opens
    const loadActivities = async () => {
        if (!selectedSubcontractorId) return;
        const { data: actData } = await supabase
            .from('work_activities')
            .select('*')
            .eq('is_active', true)
            .eq('subcontractor_id', selectedSubcontractorId)
            .order('name', { ascending: true });

        if (actData) setActivities(actData);
    };

    // Load activities & areas when subcontractor changes
    useEffect(() => {
        if (!selectedSubcontractorId) {
            setActivities([]);
            setAssignedAreas([]);
            return;
        }

        async function loadAssignedAreas() {
            // Get areas assigned to this subcontractor
            const { data: areaData } = await supabase
                .from('subcontractor_areas')
                .select(`
                    global_area_id,
                    global_areas (
                        id,
                        building,
                        floor,
                        zone,
                        description
                    )
                `)
                .eq('subcontractor_id', selectedSubcontractorId);

            if (areaData) {
                const areas = areaData
                    .map((a: any) => a.global_areas)
                    .filter(Boolean)
                    .sort((a: any, b: any) => {
                        if (a.building !== b.building) return a.building.localeCompare(b.building);
                        if (a.floor !== b.floor) return (a.floor || '').localeCompare(b.floor || '');
                        return (a.zone || '').localeCompare(b.zone || '');
                    });
                setAssignedAreas(areas);
            }
        }

        loadActivities();
        loadAssignedAreas();
    }, [selectedSubcontractorId]);

    // Refresh activities list whenever the manpower modal opens so
    // activities added elsewhere (e.g. ActivityRegisterWidget) appear
    useEffect(() => {
        if (showManpowerModal) {
            loadActivities();
        }
    }, [showManpowerModal]);

    // Add new activity
    const handleAddActivity = async () => {
        if (!newActivityName.trim() || !selectedSubcontractorId) return;
        
        const { data, error } = await supabase
            .from('work_activities')
            .insert([{
                name: newActivityName.trim(),
                description: newActivityDesc.trim(),
                change_order_number: newActivityChangeOrder.trim() || null,
                subcontractor_id: selectedSubcontractorId,
                is_active: true,
                status: 'planned'
            }])
            .select();
        
        if (!error && data) {
            setActivities([...activities, data[0]]);
            setNewActivityName('');
            setNewActivityDesc('');
            setNewActivityChangeOrder('');
            setShowQuickAddActivity(false);
            // Auto-select the new activity
            setNewManpower({ ...newManpower, billable_activities: [...newManpower.billable_activities, { activity_id: data[0].id, hours: '' }] });
        } else {
            alert('Kunne ikke legge til aktivitet. Prøv igjen.');
        }
    };

    // Edit activity
    const handleEditActivity = async (activityId: string, newName: string, newDesc: string, newChangeOrder: string) => {
        const { data, error } = await supabase
            .from('work_activities')
            .update({ 
                name: newName.trim(), 
                description: newDesc.trim(), 
                change_order_number: newChangeOrder.trim() || null,
                updated_at: new Date().toISOString() 
            })
            .eq('id', activityId)
            .select();
        
        if (!error && data) {
            setActivities(activities.map(a => a.id === activityId ? data[0] : a));
        } else {
            alert('Kunne ikke oppdatere aktivitet. Prøv igjen.');
        }
    };

    // Delete activity (soft delete by setting is_active = false)
    const handleDeleteActivity = async (activityId: string) => {
        if (!confirm('Er du sikker på at du vil slette denne aktiviteten?')) return;
        
        const { error } = await supabase
            .from('work_activities')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', activityId);
        
        if (!error) {
            setActivities(activities.filter(a => a.id !== activityId));
        } else {
            alert('Kunne ikke slette aktivitet. Prøv igjen.');
        }
    };

    useEffect(() => {
        refreshManpower();
    }, [selectedSubcontractorId]);

    const handleAddManpower = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const validActivities = newManpower.billable_activities.filter(act => act.activity_id);
        const totalWorkers = Number(newManpower.total_workers_per_day) || 0;
        // Allow logging 0 manpower (e.g. holidays, no-work days) — no guard.
        const payload: any = {
            subcontractor_id: selectedSubcontractorId,
            date: newManpower.date,
            workers_count: totalWorkers,
            contract_workers: Number(newManpower.contract_workers) || 0,
            billable_workers: Number(newManpower.billable_workers) || 0,
            is_contract_work: Number(newManpower.contract_workers) > 0,
            notes: newManpower.notes,
            billable_comment: newManpower.billable_comment,
            activity_id: validActivities.length === 1 ? validActivities[0].activity_id : null,
            hours_contract: 0,
            hours_billable: validActivities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0),
            billable_activities: validActivities
        };

        if (newManpower.id) {
            payload.id = newManpower.id;
        }

        let response;
        if (newManpower.id) {
            response = await supabase.from('daily_manpower').update(payload).eq('id', newManpower.id).select();
        } else {
            response = await supabase.from('daily_manpower').insert([payload]).select();
        }

        const { data, error } = response;

        if (!error && data) {
            const manpowerId = data[0].id;
            
            // Handle position/area relationships
            if (newManpower.position_ids.length > 0) {
                // Delete existing positions for this manpower entry
                await supabase.from('daily_manpower_positions').delete().eq('daily_manpower_id', manpowerId);
                
                // Insert new positions
                const positionInserts = newManpower.position_ids.map(areaId => ({
                    daily_manpower_id: manpowerId,
                    global_area_id: areaId
                }));
                await supabase.from('daily_manpower_positions').insert(positionInserts);
            } else if (newManpower.id) {
                // If editing and no positions selected, delete existing
                await supabase.from('daily_manpower_positions').delete().eq('daily_manpower_id', manpowerId);
            }
            
            let updatedManpower = [...manpower];
            if (newManpower.id) {
                updatedManpower = updatedManpower.map(m => m.id === newManpower.id ? data[0] : m);
            } else {
                updatedManpower = [data[0], ...updatedManpower];
            }
            setManpower(updatedManpower.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            // Sync the miniature overview data for this subcontractor
            if (selectedSubcontractorId) {
                setManpowerBySub(prev => {
                    const list = prev[selectedSubcontractorId] || [];
                    let updatedMulti: any[];
                    if (newManpower.id) {
                        updatedMulti = list.map(m => m.id === newManpower.id ? data[0] : m);
                    } else {
                        updatedMulti = [data[0], ...list];
                    }
                    return { ...prev, [selectedSubcontractorId]: updatedMulti };
                });
            }
            setShowManpowerModal(false);
            resetForm();
        } else {
            alert('Kunne ikke lagre mannskapslogg. Vennligst prøv igjen.');
        }
        setLoading(false);
    };

    if (selectedSubIds.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <ClipboardList className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenører valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Klikk "Velg UE" i toppen for å velge underentreprenører du vil vise mannskap for.</p>
            </div>
        );
    }

    const todayStr = (() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })();
    const hasLoggedToday = manpower.some(log => log.date === todayStr);
    const isPast14 = new Date().getHours() >= 14;
    const showReminder = isPast14 && !hasLoggedToday;

    const renderExpandedView = (sub: any, subs: any[]) => {
        const viewMode = expandedViewModes[sub.id] || 'week';
        const setViewMode = (m: 'week' | 'month') => setExpandedViewModes(prev => ({ ...prev, [sub.id]: m }));
        if (viewMode === 'week') {
            return (
                <div className="p-4 bg-slate-50/70 border-y border-primary-200">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-extrabold text-slate-700">{sub.company_name} — Uke {getWeekNumber(currentWeekStart)}</h4>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                <button onClick={() => setViewMode('week')} className="px-2 py-1 text-[9px] font-bold rounded bg-primary-600 text-white">Uke</button>
                                <button onClick={() => setViewMode('month')} className="px-2 py-1 text-[9px] font-bold rounded bg-white text-slate-500 border border-slate-200">Måned</button>
                            </div>
                            <button onClick={() => setHoveredSubId(null)} className="px-2 py-1 text-[9px] font-bold rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Mindre</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 7 }).map((_, i) => {
                            const date = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
                            const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            const log = subs.find(l => l.date === ds);
                            return (
                                <div key={ds} className="bg-white rounded-lg p-2 border border-slate-200">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{date.toLocaleDateString('no-NO', { weekday: 'short' })}</div>
                                    <div className="text-sm font-extrabold text-slate-700">{date.getDate()}</div>
                                    <div className="text-lg font-black text-primary-600 mt-1">{log ? (log.workers_count || 0) : 0}</div>
                                    {log?.notes && (
                                        <div className="text-[9px] text-slate-500 mt-1 truncate" title={log.notes}>
                                            📝 {log.notes}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        // Month view
        const firstDay = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 1);
        const lastDay = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
        let startDayOfWeek = firstDay.getDay() || 7;
        const cells: (Date | null)[] = [];
        for (let i = 1; i < startDayOfWeek; i++) cells.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) cells.push(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), i));
        const remainder = cells.length % 7;
        if (remainder !== 0) for (let i = remainder; i < 7; i++) cells.push(null);
        return (
            <div className="p-4 bg-slate-50/70 border-y border-primary-200">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-extrabold text-slate-700">{sub.company_name} — {currentMonthStart.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}</h4>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <button onClick={() => setViewMode('week')} className="px-2 py-1 text-[9px] font-bold rounded bg-white text-slate-500 border border-slate-200">Uke</button>
                            <button onClick={() => setViewMode('month')} className="px-2 py-1 text-[9px] font-bold rounded bg-primary-600 text-white">Måned</button>
                        </div>
                        <button onClick={() => setHoveredSubId(null)} className="px-2 py-1 text-[9px] font-bold rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Mindre</button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map(d => (
                        <div key={d} className="text-center text-[8px] font-bold text-slate-400 uppercase">{d}</div>
                    ))}
                    {cells.map((date, idx) => {
                        if (!date) return <div key={`e-${idx}`} className="h-12" />;
                        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        const log = subs.find(l => l.date === ds);
                        const total = log ? (log.workers_count || 0) : 0;
                        return (
                            <div key={ds} className={`text-center py-1 rounded text-[9px] font-bold ${total > 0 ? 'bg-primary-100 text-primary-700' : 'bg-white text-slate-400'} border border-slate-100`}>
                                <div>{date.getDate()}</div>
                                <div>{total > 0 ? total : '–'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {showReminder && (
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="flex items-start gap-3.5">
                        <div className="bg-amber-100 p-2.5 rounded-2xl text-amber-700 shrink-0">
                            <Clock className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-base font-extrabold text-amber-900">Mangler bemanning for i dag</h4>
                            <p className="text-sm text-amber-700 font-medium mt-0.5">
                                Husk å loggføre dagens bemanning. Fristen er kl. 14:00, og den er nå passert.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            resetForm();
                            setNewManpower(prev => ({
                                ...prev,
                                date: todayStr
                            }));
                            setShowManpowerModal(true);
                        }}
                        className="bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(217,119,6,0.2)] hover:bg-amber-700 transition-colors shrink-0 flex items-center justify-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        Loggfør nå
                    </button>
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bemanning</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Daglig mannskapslogg og personell</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <div className="relative">
                        <button onClick={() => setShowSubDropdown(!showSubDropdown)} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center shrink-0">
                            <Users className="w-4 h-4 mr-2" />
                            Velg UE ({selectedSubIds.length})
                        </button>
                        {showSubDropdown && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowSubDropdown(false)} />
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-96 overflow-hidden flex flex-col">
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Underentreprenører</span>
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
                    <button onClick={() => setShowActivityModal(true)} className="bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center shrink-0">
                        <Settings className="w-4 h-4 mr-2" />
                        Administrer Aktiviteter
                    </button>
                    <button onClick={() => { resetForm(); setShowManpowerModal(true); }} className="bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors flex items-center shrink-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Loggfør Mannskap
                    </button>
                </div>
            </div>

            {/* Mannskapsoversikt — global overview of all selected subcontractors (at the top) */}
            {selectedSubIds.length > 0 && (
                <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-extrabold text-slate-800 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-primary-500" />
                            Mannskapsoversikt ({selectedSubIds.length})
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest min-w-[60px] text-center">Uke {getWeekNumber(currentWeekStart)}</span>
                            <button onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-[200px]">Underentreprenør</th>
                                    {Array.from({ length: 7 }).map((_, i) => {
                                        const date = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
                                        return (
                                            <th key={i} className="text-center py-2 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                <div className="text-[9px] text-slate-400 font-bold">{date.toLocaleDateString('no-NO', { weekday: 'short' })}</div>
                                                <div className="text-sm font-extrabold text-slate-700 mt-0.5">{date.getDate()}</div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {[...subcontractors].filter(s => selectedSubIds.includes(s.id)).sort((a, b) => {
                                    const aP = a.type === 'project' ? 1 : 0, bP = b.type === 'project' ? 1 : 0;
                                    if (aP !== bP) return aP - bP;
                                    return a.company_name.localeCompare(b.company_name, 'no');
                                }).map(sub => {
                                    const subs = manpowerBySub[sub.id] || [];
                                    return (
                                        <Fragment key={sub.id}>
                                            <tr
                                                className={`border-b border-slate-100 transition-colors ${sub.type === 'project' ? 'bg-purple-50/30' : ''} hover:bg-primary-50/40`}
                                            >
                                                <td className="py-2 pr-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setHoveredSubId(hoveredSubId === sub.id ? null : sub.id)}
                                                            className="px-2 py-1 text-[9px] font-bold rounded bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700 transition-colors"
                                                        >
                                                            {hoveredSubId === sub.id ? 'Mindre' : 'Vis'}
                                                        </button>
                                                        <span className="text-xs font-bold text-slate-800 truncate">{sub.company_name}</span>
                                                        {sub.type === 'project' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-100 text-purple-700 border border-purple-200 shrink-0">Prosjekt</span>}
                                                    </div>
                                                </td>
                                                {Array.from({ length: 7 }).map((_, i) => {
                                                    const date = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
                                                    const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                                                    const log = subs.find(l => l.date === ds);
                                                    const total = log ? (log.workers_count || 0) : 0;
                                                    return (
                                                        <td key={i} className="text-center py-2 px-1">
                                                            <button type="button" onClick={() => {
                                                                setSelectedSubcontractorId(sub.id);
                                                                setNewManpower({
                                                                    id: log?.id,
                                                                    date: ds,
                                                                    contract_workers: log?.contract_workers ?? '',
                                                                    billable_workers: log?.billable_workers ?? '',
                                                                    total_workers_per_day: log?.workers_count ?? '',
                                                                    notes: log?.notes || '',
                                                                    billable_comment: log?.billable_comment || log?.comment || '',
                                                                    billable_activities: log?.billable_activities || (log?.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),
                                                                    position_ids: log?.daily_manpower_positions?.map((p: any) => p.global_area_id) || []
                                                                });
                                                                setShowManpowerModal(true);
                                                            }} className={`w-full py-1.5 rounded-md text-[10px] font-bold ${total > 0 ? 'bg-primary-100 text-primary-700 hover:bg-primary-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                                {total > 0 ? total : '–'}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            {hoveredSubId === sub.id && (
                                                <tr>
                                                    <td colSpan={8} className="p-0">
                                                        {renderExpandedView(sub, subs)}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}



            {/* Manpower Modal */}
            {showManpowerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                            <h3 className="text-lg font-extrabold text-slate-800">Loggfør Mannskap</h3>
                            <button onClick={() => setShowManpowerModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddManpower} className="p-6 space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dato</label>
                                <DatePickerWithWeek
                                    selected={newManpower.date ? new Date(newManpower.date) : null}
                                    onChange={(date) => {
                                        const newDate = date ? date.toISOString().split('T')[0] : '';
                                        setNewManpower({ ...newManpower, date: newDate, /* hours_billable removed */ });
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    required
                                />
                            </div>

                            {/* Kopier data fra forrige dag knapp */}
                            {newManpower.date && !newManpower.id && (
                                <div className="px-1 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleCopyPreviousDay}
                                        className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:border-slate-300"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                                        Kopier data fra forrige registrerte dag
                                    </button>
                                </div>
                            )}

                            {/* Activities and Hours Section */}
                            {Number(newManpower.billable_workers) > 0 && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">Aktiviteter for regningsarbeid</label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickAddActivity(!showQuickAddActivity)}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center p-1"
                                            >
                                                <Plus className="w-4 h-4 mr-1" />
                                                Ny aktivitet
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {showQuickAddActivity && (
                                        <div className="bg-primary-50 p-4 rounded-xl border border-primary-200 space-y-3">
                                            <input
                                                type="text"
                                                value={newActivityName}
                                                onChange={(e) => setNewActivityName(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                placeholder="Navn på aktivitet *"
                                            />
                                            <input
                                                type="text"
                                                value={newActivityDesc}
                                                onChange={(e) => setNewActivityDesc(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                placeholder="Beskrivelse (valgfritt)"
                                            />
                                            <input
                                                type="text"
                                                value={newActivityChangeOrder}
                                                onChange={(e) => setNewActivityChangeOrder(e.target.value)}
                                                className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                placeholder="Endringsmelding nummer (f.eks. EM-001)"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAddActivity}
                                                    disabled={!newActivityName.trim()}
                                                    className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                                                >
                                                    Opprett aktivitet
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowQuickAddActivity(false);
                                                        setNewActivityName('');
                                                        setNewActivityDesc('');
                                                        setNewActivityChangeOrder('');
                                                    }}
                                                    className="px-3 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                                >
                                                    Avbryt
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {newManpower.billable_activities.map((act, index) => (
                                            <div key={index} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-200 relative">
                                                <div className="flex-1">
                                                    <select
                                                        value={act.activity_id}
                                                        onChange={(e) => {
                                                            const newActivities = [...newManpower.billable_activities];
                                                            newActivities[index].activity_id = e.target.value;
                                                            setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                        }}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm sm:text-base"
                                                    >
                                                        <option value="">Velg aktivitet...</option>
                                                        {filteredActivitiesForDropdown.map(activity => (
                                                            <option key={activity.id} value={activity.id}>
                                                                {activity.name}{activity.change_order_number ? ` (${activity.change_order_number})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={act.hours}
                                                            onChange={(e) => {
                                                                const newActivities = [...newManpower.billable_activities];
                                                                newActivities[index].hours = e.target.value === '' ? '' : Number(e.target.value);
                                                                setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                            }}
                                                            className="w-full bg-white border border-amber-300 rounded-lg px-2 py-2.5 font-extrabold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-6 text-center text-sm sm:text-base"
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-sm pointer-events-none">t</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newActivities = newManpower.billable_activities.filter((_, i) => i !== index);
                                                        setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                    }}
                                                    className="p-2.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-lg ml-1"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const totalHoursSoFar = newManpower.billable_activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
                                                const defaultHours = getDefaultHours(newManpower.date, Number(newManpower.billable_workers) || 0);
                                                const remainingHours = Math.max(0, defaultHours - totalHoursSoFar);
                                                setNewManpower({ 
                                                    ...newManpower, 
                                                    billable_activities: [...newManpower.billable_activities, { activity_id: '', hours: remainingHours || '' }] 
                                                });
                                            }}
                                            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center text-sm bg-white"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Legg til ny regningsaktivitet
                                        </button>
                                        <p className="text-xs text-slate-500 mt-2 text-center uppercase tracking-widest font-bold">
                                            Forventet: {getDefaultHours(newManpower.date, Number(newManpower.billable_workers) || 0)}t | Totalt utfylt: {newManpower.billable_activities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0)}t
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 md:p-5">
                                    <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Kontraktsarbeidere</label>
                                    <div className="flex items-center justify-between gap-4">
                                        <button 
                                            type="button" 
                                            onClick={() => setNewManpower({ ...newManpower, contract_workers: Math.max(0, (Number(newManpower.contract_workers) || 0) - 1) })}
                                            className="w-16 h-16 shrink-0 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Minus className="w-8 h-8" />
                                        </button>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={newManpower.contract_workers}
                                            onChange={(e) => setNewManpower({ ...newManpower, contract_workers: e.target.value === '' ? '' : Number(e.target.value) })}
                                            className="w-full bg-white border border-slate-200/80 rounded-2xl px-2 py-4 text-3xl font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 shadow-inner"
                                            placeholder="0"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setNewManpower({ ...newManpower, contract_workers: (Number(newManpower.contract_workers) || 0) + 1 })}
                                            className="w-16 h-16 shrink-0 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-primary-500 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Plus className="w-8 h-8" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-amber-50/50 border border-amber-200/60 rounded-3xl p-4 md:p-5">
                                    <label className="block text-sm font-bold text-amber-700/70 uppercase tracking-widest mb-4 text-center">Regningsarbeidere</label>
                                    <div className="flex items-center justify-between gap-4">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const workers = Math.max(0, (Number(newManpower.billable_workers) || 0) - 1);
                                                setNewManpower({ ...newManpower, billable_workers: workers });
                                            }}
                                            className="w-16 h-16 shrink-0 bg-white border border-amber-200/80 rounded-2xl flex items-center justify-center text-amber-600 hover:bg-amber-100 hover:text-amber-800 hover:border-amber-300 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Minus className="w-8 h-8" />
                                        </button>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            value={newManpower.billable_workers}
                                            onChange={(e) => {
                                                const workers = e.target.value === '' ? '' : Number(e.target.value);
                                                setNewManpower({ ...newManpower, billable_workers: workers });
                                            }}
                                            className="w-full bg-white border border-amber-200/80 rounded-2xl px-2 py-4 text-3xl font-black text-amber-900 text-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-inner"
                                            placeholder="0"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const workers = (Number(newManpower.billable_workers) || 0) + 1;
                                                setNewManpower({ ...newManpower, billable_workers: workers });
                                            }}
                                            className="w-16 h-16 shrink-0 bg-white border border-amber-200/80 rounded-2xl flex items-center justify-center text-amber-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Plus className="w-8 h-8" />
                                        </button>
                                    </div>
                                </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4 md:p-5">
                            <label className="block text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Totalt antall arbeidere (manuell)</label>
                            <div className="flex items-center justify-between gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setNewManpower({ ...newManpower, total_workers_per_day: Math.max(0, (Number(newManpower.total_workers_per_day) || 0) - 1) })}
                                    className="w-16 h-16 shrink-0 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300 active:scale-95 transition-all shadow-sm"
                                >
                                    <Minus className="w-8 h-8" />
                                </button>
                                <input
                                    type="number"
                                    min="0"
                                    value={newManpower.total_workers_per_day}
                                    onChange={(e) => setNewManpower({ ...newManpower, total_workers_per_day: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-full bg-white border border-slate-200/80 rounded-2xl px-2 py-4 text-3xl font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 shadow-inner"
                                    placeholder="0"
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setNewManpower({ ...newManpower, total_workers_per_day: (Number(newManpower.total_workers_per_day) || 0) + 1 })}
                                    className="w-16 h-16 shrink-0 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center text-primary-500 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 active:scale-95 transition-all shadow-sm"
                                >
                                    <Plus className="w-8 h-8" />
                                </button>
                            </div>
                        </div>

                        {/* Position/Area Selection - Multi-select with checkboxes */}
                            {assignedAreas.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Posisjoner/Områder (valgfritt)</label>
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                                        {assignedAreas.map((area: any) => (
                                            <label key={area.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={newManpower.position_ids.includes(area.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNewManpower({ ...newManpower, position_ids: [...newManpower.position_ids, area.id] });
                                                        } else {
                                                            setNewManpower({ ...newManpower, position_ids: newManpower.position_ids.filter(id => id !== area.id) });
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-slate-700">
                                                    {area.building}{area.floor ? ` - ${area.floor}` : ''}{area.zone ? ` - ${area.zone}` : ''}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    {newManpower.position_ids.length > 0 && (
                                        <p className="text-xs text-slate-500 mt-1">{newManpower.position_ids.length} område(r) valgt</p>
                                    )}
                                </div>
                            )}

                            {/* Hours Section */}


                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                    <span className="text-sm font-bold text-slate-700">Totalt antall arbeidere i dag:</span>
                                    <span className="text-xl font-extrabold text-primary-600">{Number(newManpower.total_workers_per_day) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                    <span className="text-sm font-bold text-slate-700">Regningstimer:</span>
                                    <span className="text-xl font-extrabold text-amber-600">{newManpower.billable_activities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0)}</span>
                                </div>

                                {Number(newManpower.billable_workers) > 0 && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 pt-2">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">
                                            Kommentar for regningsarbeid {newManpower.billable_activities.length === 0 && <span className="text-red-500">*</span>}
                                        </label>
                                        <textarea
                                            rows={2}
                                            required={Number(newManpower.billable_workers) > 0 && newManpower.billable_activities.length === 0}
                                            value={newManpower.billable_comment}
                                            onChange={(e) => setNewManpower({ ...newManpower, billable_comment: e.target.value })}
                                            className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-400"
                                            placeholder={newManpower.billable_activities.length > 0 ? "Valgfri kommentar (aktiviteter er valgt)" : "Gjelder regningsarbeid for... (Kreves når arbeidere er registrert på regning uten aktivitet)"}
                                        />
                                        {newManpower.billable_activities.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-1">Kommentar er valgfri når aktiviteter er valgt.</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Notater (valgfritt)</label>
                                <textarea
                                    rows={3}
                                    value={newManpower.notes}
                                    onChange={(e) => setNewManpower({ ...newManpower, notes: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="Skriv inn notater for skiftet..."
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowManpowerModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
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

            {/* Activity Management Modal */}
            {showActivityModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                            <h3 className="text-lg font-extrabold text-slate-800">Administrer Aktiviteter</h3>
                            <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* Existing Activities */}
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {activities.length === 0 ? (
                                    <p className="text-center text-slate-500 py-4">Ingen aktiviteter registrert ennå.</p>
                                ) : (
                                    activities.map(activity => (
                                        <div key={activity.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            {editingActivityId === activity.id ? (
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={editActivityName}
                                                        onChange={(e) => setEditActivityName(e.target.value)}
                                                        className="w-full bg-white border border-primary-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                        placeholder="Navn på aktivitet"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editActivityDesc}
                                                        onChange={(e) => setEditActivityDesc(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                        placeholder="Beskrivelse (valgfritt)"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={editActivityChangeOrder}
                                                        onChange={(e) => setEditActivityChangeOrder(e.target.value)}
                                                        className="w-full bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                        placeholder="Endringsmelding nummer (f.eks. EM-001)"
                                                    />
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                handleEditActivity(activity.id, editActivityName, editActivityDesc, editActivityChangeOrder);
                                                                setEditingActivityId(null);
                                                            }}
                                                            disabled={!editActivityName.trim()}
                                                            className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                                                        >
                                                            <Check className="w-4 h-4 mr-1" /> Lagre
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingActivityId(null)}
                                                            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                                        >
                                                            Avbryt
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-1">
                                                        <span className="font-bold text-slate-800">{activity.name}</span>
                                                        {activity.description && (
                                                            <p className="text-xs text-slate-500">{activity.description}</p>
                                                        )}
                                                        {activity.change_order_number && (
                                                            <p className="text-xs text-blue-600 font-medium">EM: {activity.change_order_number}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingActivityId(activity.id);
                                                                setEditActivityName(activity.name);
                                                                setEditActivityDesc(activity.description || '');
                                                                setEditActivityChangeOrder(activity.change_order_number || '');
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                            title="Rediger aktivitet"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteActivity(activity.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Slett aktivitet"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add New Activity */}
                            <div className="border-t border-slate-200 pt-4 space-y-3">
                                <h4 className="font-bold text-slate-700">Legg til ny aktivitet</h4>
                                <input
                                    type="text"
                                    value={newActivityName}
                                    onChange={(e) => setNewActivityName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    placeholder="Navn på aktivitet"
                                />
                                <input
                                    type="text"
                                    value={newActivityDesc}
                                    onChange={(e) => setNewActivityDesc(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    placeholder="Beskrivelse (valgfritt)"
                                />
                                <input
                                    type="text"
                                    value={newActivityChangeOrder}
                                    onChange={(e) => setNewActivityChangeOrder(e.target.value)}
                                    className="w-full bg-slate-50 border border-blue-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                    placeholder="Endringsmelding nummer (f.eks. EM-001)"
                                />
                                <button
                                    onClick={handleAddActivity}
                                    disabled={!newActivityName.trim()}
                                    className="w-full px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Legg til Aktivitet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper specific to this component for ISO week number
function getWeekNumber(d: Date) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
