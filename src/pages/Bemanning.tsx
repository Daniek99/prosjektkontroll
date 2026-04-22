import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Users, Plus, Minus, ClipboardList, ChevronLeft, ChevronRight, X, Clock, Edit2, Settings, Trash2, Check } from 'lucide-react';

export default function Bemanning() {
    const { selectedSubcontractorId } = useSubcontractor();
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
        notes: '',
        billable_comment: '',
        billable_activities: [],
        position_ids: []
    });

    const [assignedAreas, setAssignedAreas] = useState<any[]>([]);

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
            notes: '',
            billable_comment: '',
            billable_activities: [],
            position_ids: []
        });
    };

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

    // Load activities when subcontractor changes
    useEffect(() => {
        if (!selectedSubcontractorId) {
            setActivities([]);
            setAssignedAreas([]);
            return;
        }
        
        async function loadActivities() {
            const { data: actData } = await supabase
                .from('work_activities')
                .select('*')
                .eq('is_active', true)
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('name', { ascending: true });
            
            if (actData) setActivities(actData);
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

    // Add new activity
    const handleAddActivity = async () => {
        if (!newActivityName.trim() || !selectedSubcontractorId) return;
        
        const { data, error } = await supabase
            .from('work_activities')
            .insert([{ 
                name: newActivityName.trim(), 
                description: newActivityDesc.trim(),
                change_order_number: newActivityChangeOrder.trim() || null,
                subcontractor_id: selectedSubcontractorId 
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
        if (!selectedSubcontractorId) return;

        async function loadLogs() {
            setLoading(true);
            const { data: mData } = await supabase
                .from('daily_manpower')
                .select(`
                    *,
                    daily_manpower_positions (
                        global_area_id
                    )
                `)
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('date', { ascending: false })
                .limit(100); // Increased limit to cover a month or more

            if (mData) setManpower(mData);
            setLoading(false);
        }
        loadLogs();
    }, [selectedSubcontractorId]);

    const handleAddManpower = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const validActivities = newManpower.billable_activities.filter(act => act.activity_id);
        const payload: any = {
            subcontractor_id: selectedSubcontractorId,
            date: newManpower.date,
            workers_count: (Number(newManpower.contract_workers) || 0) + (Number(newManpower.billable_workers) || 0),
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
            setShowManpowerModal(false);
            resetForm();
        } else {
            alert('Kunne ikke lagre mannskapslogg. Vennligst prøv igjen.');
        }
        setLoading(false);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <ClipboardList className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å se byggeplasslogger.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Bemanning</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Daglig mannskapslogg og personell</p>
                </div>
                <div className="flex gap-3">
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

            <div>
                {/* Manpower Weekly Calendar */}
                <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm flex flex-col h-[500px]">
                    <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center rounded-t-3xl">
                        <h3 className="font-extrabold text-slate-800 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-primary-500" />
                            Daglig Mannskap
                        </h3>
                        <div className="flex items-center space-x-4">
                            <div className="flex bg-slate-200/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewMode('week')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Uke
                                </button>
                                <button
                                    onClick={() => setViewMode('month')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Måned
                                </button>
                            </div>

                            {viewMode === 'week' ? (
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest min-w-[70px] text-center">
                                        Uke {getWeekNumber(currentWeekStart)}
                                    </span>
                                    <button onClick={() => setCurrentWeekStart(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setCurrentMonthStart(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest min-w-[100px] text-center">
                                        {currentMonthStart.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button onClick={() => setCurrentMonthStart(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1))} className="p-1 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-50/30">
                        {loading ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                        ) : viewMode === 'week' ? (
                            <div className="grid grid-cols-7 gap-2 h-full">
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const date = new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const dateStr = `${year}-${month}-${day}`;
                                    const logsForDay = manpower.filter(m => m.date === dateStr);
                                    const totalWorkers = logsForDay.reduce((sum, log) => sum + log.workers_count, 0);
                                    const today = new Date();
                                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                    const isToday = todayStr === dateStr;

                                    return (
                                        <div
                                            key={dateStr}
                                            onClick={() => {
                                                if (logsForDay.length > 0) {
                                                    const log = logsForDay[0];
                                                    const positionIds = log.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];
                                                    setNewManpower({
                                                        id: log.id,
                                                        date: log.date,
                                                        contract_workers: log.contract_workers ?? '',
                                                        billable_workers: log.billable_workers ?? '',
                                                        notes: log.notes || '',
                                                        billable_comment: log.billable_comment || log.comment || '',
                                                        billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),
                                                        position_ids: positionIds
                                                    });
                                                } else {
                                                    setNewManpower({
                                                        date: dateStr,
                                                        contract_workers: '',
                                                        billable_workers: '',
                                                        notes: '',
                                                        billable_comment: '',
                                                        billable_activities: [],
                                                        position_ids: []
                                                    });
                                                }
                                                setShowManpowerModal(true);
                                            }}
                                            className={`flex flex-col h-full rounded-2xl border cursor-pointer ${isToday ? 'border-primary-400 bg-primary-50/20 shadow-sm ring-1 ring-primary-400/20' : 'border-slate-200 bg-white'} overflow-hidden transition-all hover:border-primary-400 hover:shadow-md hover:-translate-y-0.5`}
                                        >
                                            <div className={`py-2 text-center border-b ${isToday ? 'bg-primary-100/50 border-primary-200' : 'bg-slate-50 border-slate-100'} group-hover:bg-primary-50 transition-colors`}>
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary-500">
                                                    {date.toLocaleDateString('no-NO', { weekday: 'short' })}
                                                </div>
                                                <div className={`text-lg font-extrabold ${isToday ? 'text-primary-700' : 'text-slate-700'}`}>
                                                    {date.getDate()}
                                                </div>
                                            </div>
                                            <div className="flex-1 flex flex-col items-center justify-center p-2 relative group">
                                                {totalWorkers > 0 ? (
                                                    <div className="flex flex-col items-center group-hover:scale-110 transition-transform w-full px-1">
                                                        <span className="text-2xl font-extrabold text-slate-800">{String((logsForDay[0].contract_workers || 0) + (logsForDay[0].billable_workers || 0))}</span>
                                                        <div className="flex w-full justify-between text-[9px] uppercase tracking-widest font-bold mt-1">
                                                            <span className="text-primary-600 bg-primary-50 px-1 rounded" title="Kontraktsarbeidere">{logsForDay[0].contract_workers || 0} K</span>
                                                            <span className="text-amber-600 bg-amber-50 px-1 rounded" title="Regningsarbeidere">{logsForDay[0].billable_workers || 0} R</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 font-medium text-sm group-hover:text-primary-400 transition-colors"><Plus className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500" />-</span>
                                                )}

                                                {logsForDay.some(l => l.notes) && (
                                                    <div className="absolute inset-x-2 py-1.5 px-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none -translate-y-2 group-hover:-translate-y-3 z-10 bottom-full truncate line-clamp-3">
                                                        {logsForDay.filter(l => l.notes).map(l => l.notes).join(' | ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(day => (
                                        <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">{day}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 grid-rows-5 gap-1 flex-1">
                                    {(() => {
                                        const cells = [];
                                        const firstDay = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), 1);
                                        const lastDay = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0);
                                        let startDayOfWeek = firstDay.getDay() || 7;
                                        for (let i = 1; i < startDayOfWeek; i++) {
                                            cells.push(null);
                                        }
                                        for (let i = 1; i <= lastDay.getDate(); i++) {
                                            cells.push(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth(), i));
                                        }
                                        const remainder = cells.length % 7;
                                        if (remainder !== 0) {
                                            for (let i = remainder; i < 7; i++) {
                                                cells.push(null);
                                            }
                                        }

                                        return cells.map((date, idx) => {
                                            if (!date) return <div key={`empty-${idx}`} className="bg-slate-100/50 rounded-xl border border-transparent"></div>;

                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            const dateStr = `${year}-${month}-${day}`;
                                            const logsForDay = manpower.filter(m => m.date === dateStr);
                                            const totalWorkers = logsForDay.reduce((sum, log) => sum + log.workers_count, 0);
                                            const today = new Date();
                                            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                            const isToday = todayStr === dateStr;

                                            return (
                                                <div
                                                    key={dateStr}
                                            onClick={() => {
                                                if (logsForDay.length > 0) {
                                                    const log = logsForDay[0];
                                                    const positionIds = log.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];
                                                    setNewManpower({
                                                        id: log.id,
                                                        date: log.date,
                                                        contract_workers: log.contract_workers ?? '',
                                                        billable_workers: log.billable_workers ?? '',
                                                        notes: log.notes || '',
                                                        billable_comment: log.billable_comment || log.comment || '',
                                                        billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),
                                                        position_ids: positionIds
                                                    });
                                                } else {
                                                    setNewManpower({
                                                        date: dateStr,
                                                        contract_workers: '',
                                                        billable_workers: '',
                                                        notes: '',
                                                        billable_comment: '',
                                                        billable_activities: [],
                                                        position_ids: []
                                                    });
                                                }
                                                setShowManpowerModal(true);
                                            }}
                                                    className={`flex flex-col p-1.5 sm:p-2 rounded-xl border cursor-pointer ${isToday ? 'border-primary-400 bg-primary-50/20 shadow-sm ring-1 ring-primary-400/20' : 'border-slate-200 bg-white'} overflow-hidden transition-all hover:border-primary-400 hover:shadow-md relative group min-h-[60px]`}
                                                >
                                                    <span className={`text-xs font-bold leading-none ${isToday ? 'text-primary-700' : 'text-slate-500'}`}>
                                                        {date.getDate()}
                                                    </span>
                                                    <div className="flex-1 flex flex-col items-center justify-center mt-1">
                                                        {totalWorkers > 0 ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-lg sm:text-xl font-extrabold text-slate-800 leading-none">{String((logsForDay[0].contract_workers || 0) + (logsForDay[0].billable_workers || 0))}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 font-medium text-xs group-hover:text-primary-400 transition-colors"><Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500" /></span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Logs List */}
                <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm flex flex-col h-[500px]">
                    <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center rounded-t-3xl">
                        <h3 className="font-extrabold text-slate-800 flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-slate-500" />
                            Siste registreringer
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-3">
                        {manpower.length === 0 ? (
                            <div className="text-center p-8 text-slate-500 font-medium">Ingen logger funnet.</div>
                        ) : (
                            manpower.map((log) => {
                                const activity = activities.find(a => a.id === log.activity_id);
                                return (
                                <div key={log.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-extrabold text-slate-900">{new Date(log.date).toLocaleDateString('no-NO')}</span>
                                            {log.billable_activities?.length > 1 ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700">
                                                    Flere Aktiviteter
                                                </span>
                                            ) : activity ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700">
                                                    {activity.name}
                                                </span>
                                            ) : null}
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600">
                                                Totalt {(log.contract_workers || 0) + (log.billable_workers || 0)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-700 mb-2">
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-primary-500 mr-2"></div>
                                                <span className="font-bold mr-1">{log.contract_workers || 0}</span> Kontrakt
                                            </div>
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
                                                <span className="font-bold mr-1">{log.billable_workers || 0}</span> Regning
                                            </div>
                                        </div>
                                        {(log.billable_activities && log.billable_activities.length > 0) ? (
                                            <div className="mb-2 space-y-1">
                                                {log.billable_activities.map((act: any, i: number) => {
                                                    const actDetails = activities.find((a: any) => a.id === act.activity_id);
                                                    return (
                                                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                                            <Clock className="w-3 h-3 text-amber-500" />
                                                            <span className="font-bold text-amber-700">{act.hours}t</span>
                                                            {actDetails ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-50 text-primary-700 border border-primary-100">
                                                                    {actDetails.name} {actDetails.change_order_number ? `(${actDetails.change_order_number})` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600">
                                                                    Ukjent aktivitet
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            log.hours_billable > 0 && (
                                                <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                                                    <div className="flex items-center">
                                                        <Clock className="w-3 h-3 mr-1 text-amber-500" />
                                                        <span className="font-bold mr-1">{log.hours_billable || 0}</span> regningstimer
                                                    </div>
                                                    {log.activity_id && activities.find(a => a.id === log.activity_id) && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-50 text-primary-700">
                                                            {activities.find(a => a.id === log.activity_id)?.name}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        )}
                                        {((log.billable_workers > 0 && log.billable_comment) || (log.is_contract_work === false && log.comment)) && (
                                            <div className="text-sm text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100 mb-2">
                                                <span className="font-bold block mb-0.5 text-xs text-amber-800">Kommentar (Regning):</span>
                                                {log.billable_comment || log.comment}
                                            </div>
                                        )}
                                        {log.notes && (
                                            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">{log.notes}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const positionIds = log.daily_manpower_positions?.map((p: any) => p.global_area_id) || [];
                                            setNewManpower({
                                                id: log.id,
                                                date: log.date,
                                                contract_workers: log.contract_workers ?? '',
                                                billable_workers: log.billable_workers ?? '',
                                                notes: log.notes || '',
                                                billable_comment: log.billable_comment || log.comment || '',
                                                billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),
                                                position_ids: positionIds
                                            });
                                            setShowManpowerModal(true);
                                        }}
                                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                            })
                        )}
                    </div>
                </div>
            </div>

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
                                <input
                                    type="date"
                                    required
                                    value={newManpower.date}
                                    onChange={(e) => {
                                        const newDate = e.target.value;
                                        setNewManpower({ ...newManpower, date: newDate, /* hours_billable removed */ });
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                />
                            </div>

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
                                                        {activities.map(activity => (
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
                                    <span className="text-xl font-extrabold text-primary-600">{(Number(newManpower.contract_workers) || 0) + (Number(newManpower.billable_workers) || 0)}</span>
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