import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    CheckCircle2,
    Circle,
    Plus,
    Trash2,
    Star,
    ChevronLeft,
    Calendar,
    AlignLeft,
    ChevronDown,
    ChevronUp,
    Pencil,
    GripVertical,
    Building2
} from 'lucide-react';

interface Task {
    id: string;
    title: string;
    description?: string;
    is_completed: boolean;
    is_starred?: boolean;
    due_date?: string;
    order_index: number;
    subcontractor_id?: string;
}

interface Subcontractor {
    id: string;
    name: string;
}

const toLocalDateString = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

export default function SubcontractorTodoList() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [activeTab, setActiveTab] = useState<'idag' | 'imorgen' | 'senere'>('idag');

    useEffect(() => {
        loadSubcontractors();
    }, []);

    useEffect(() => {
        if (user && selectedSubcontractorId) {
            loadTasks();
        } else {
            setTasks([]);
            setLoading(false);
        }
    }, [user, selectedSubcontractorId]);

    async function loadSubcontractors() {
        const { data, error } = await supabase
            .from('subcontractors')
            .select('id, company_name')
            .order('company_name', { ascending: true });
        
        if (!error && data) {
            // Map company_name to name for our local state
            const formattedData = data.map((d: any) => ({
                id: d.id,
                name: d.company_name
            }));
            setSubcontractors(formattedData);
            if (formattedData.length > 0 && !selectedSubcontractorId) {
                setSelectedSubcontractorId(formattedData[0].id);
            }
        }
    }

    async function loadTasks() {
        if (!user || !selectedSubcontractorId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('user_tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('subcontractor_id', selectedSubcontractorId)
            .order('is_completed', { ascending: true }) // uncompleted first
            .order('is_starred', { ascending: false }) // starred first among uncompleted
            .order('order_index', { ascending: true })
            .order('created_at', { ascending: false });

        if (!error && data) {
            setTasks(data);
        } else if (error) {
            console.error("Error loading tasks:", error);
        }
        setLoading(false);
    }

    async function handleAddTask(e: React.FormEvent) {
        e.preventDefault();
        if (!newTaskTitle.trim() || !user || !selectedSubcontractorId) return;

        let dueDate: string | null = null;
        if (activeTab === 'imorgen') {
            const tmrw = new Date();
            tmrw.setDate(tmrw.getDate() + 1);
            dueDate = toLocalDateString(tmrw);
        } else if (activeTab === 'senere') {
            const later = new Date();
            later.setDate(later.getDate() + 2);
            dueDate = toLocalDateString(later);
        }

        const newTask = {
            title: newTaskTitle.trim(),
            user_id: user.id,
            subcontractor_id: selectedSubcontractorId,
            is_completed: false,
            is_starred: false,
            due_date: dueDate,
            order_index: tasks.length
        };

        const { data, error } = await supabase
            .from('user_tasks')
            .insert([newTask])
            .select()
            .single();

        if (!error && data) {
            setTasks([data, ...tasks].sort((a, b) => (a.is_completed === b.is_completed) ? 0 : a.is_completed ? 1 : -1));
            setNewTaskTitle('');
        }
    }

    async function toggleComplete(id: string, currentStatus: boolean) {
        const newStatus = !currentStatus;

        // Optimistic update
        setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: newStatus } : t)
            .sort((a, b) => {
                const aComp = a.id === id ? newStatus : a.is_completed;
                const bComp = b.id === id ? newStatus : b.is_completed;
                if (aComp === bComp) {
                    const aStar = a.id === id ? a.is_starred : a.is_starred;
                    const bStar = b.id === id ? b.is_starred : b.is_starred;
                    if (aStar === bStar) return 0;
                    return aStar ? -1 : 1;
                }
                return aComp ? 1 : -1;
            }));

        if (selectedTask?.id === id) {
            setSelectedTask({ ...selectedTask, is_completed: newStatus });
        }

        await supabase
            .from('user_tasks')
            .update({ is_completed: newStatus })
            .eq('id', id);
    }

    async function deleteTask(id: string) {
        setTasks(tasks.filter(t => t.id !== id));
        if (selectedTask?.id === id) setSelectedTask(null);
        await supabase.from('user_tasks').delete().eq('id', id);
    }

    async function toggleStar(id: string, currentStatus: boolean | undefined) {
        const newStatus = !currentStatus;
        setTasks(tasks.map(t => t.id === id ? { ...t, is_starred: newStatus } : t)
            .sort((a, b) => {
                if (a.is_completed === b.is_completed) {
                    const aStar = a.id === id ? newStatus : a.is_starred;
                    const bStar = b.id === id ? newStatus : b.is_starred;
                    if (aStar === bStar) return 0;
                    return aStar ? -1 : 1;
                }
                return a.is_completed ? 1 : -1;
            }));

        if (selectedTask?.id === id) {
            setSelectedTask({ ...selectedTask, is_starred: newStatus });
        }

        await supabase.from('user_tasks').update({ is_starred: newStatus }).eq('id', id);
    }

    async function updateTaskDetails(id: string, updates: Partial<Task>) {
        setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
        if (selectedTask?.id === id) {
            setSelectedTask({ ...selectedTask, ...updates });
        }
        await supabase.from('user_tasks').update(updates).eq('id', id);
    }

    async function updateTitle(id: string, newTitle: string) {
        if (!newTitle.trim()) {
            setEditingId(null);
            return;
        }
        setTasks(tasks.map(t => t.id === id ? { ...t, title: newTitle.trim() } : t));
        setEditingId(null);
        await supabase.from('user_tasks').update({ title: newTitle.trim() }).eq('id', id);
    }

    const handleDropOnTab = async (e: React.DragEvent, tabName: 'idag' | 'imorgen' | 'senere') => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        if (!taskId) return;

        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        let newDueDate: string | null = null;
        const todayD = new Date();
        todayD.setHours(0, 0, 0, 0);

        if (tabName === 'imorgen') {
            const tmrw = new Date(todayD);
            tmrw.setDate(tmrw.getDate() + 1);
            newDueDate = toLocalDateString(tmrw);
        } else if (tabName === 'senere') {
            const later = new Date(todayD);
            later.setDate(later.getDate() + 2);
            newDueDate = toLocalDateString(later);
        } else {
            newDueDate = toLocalDateString(todayD);
        }

        updateTaskDetails(taskId, { due_date: newDueDate });
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const uncompletedTasks = tasks.filter(t => !t.is_completed);
    const completedTasks = tasks.filter(t => t.is_completed);

    const todayTasks = uncompletedTasks.filter(t => {
        if (!t.due_date) return true;
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() <= today.getTime();
    });

    const tomorrowTasks = uncompletedTasks.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === tomorrow.getTime();
    });

    const laterTasks = uncompletedTasks.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() > tomorrow.getTime();
    });

    const currentTasks = activeTab === 'idag' ? todayTasks : activeTab === 'imorgen' ? tomorrowTasks : laterTasks;

    const renderTaskItem = (task: Task) => (
        <div
            key={task.id}
            draggable={!task.is_completed}
            onDragStart={(e) => {
                e.dataTransfer.setData('taskId', task.id);
                e.dataTransfer.effectAllowed = 'move';
            }}
            className={`group flex items-center justify-between p-2 hover:bg-slate-50 hover:shadow-sm rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200 ${task.is_completed ? 'opacity-60 bg-slate-50/50 hover:bg-slate-100 hover:shadow-none hover:border-transparent' : ''}`}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).tagName === 'INPUT') return;
                setSelectedTask(task);
            }}
        >
            <div className="flex items-center flex-1 min-w-0">
                {!task.is_completed && (
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity mr-1 flex-shrink-0">
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}
                <button
                    onClick={() => toggleComplete(task.id, task.is_completed)}
                    className="flex-shrink-0 mr-3 text-slate-400 hover:text-blue-600 transition-colors"
                >
                    {task.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    ) : (
                        <Circle className="w-5 h-5" />
                    )}
                </button>

                <div className="flex flex-col flex-1 min-w-0">
                    {editingId === task.id ? (
                        <input
                            autoFocus
                            defaultValue={task.title}
                            onBlur={(e) => updateTitle(task.id, e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') updateTitle(task.id, e.currentTarget.value);
                                if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-sm font-medium focus:outline-none focus:border-blue-500 w-full"
                        />
                    ) : (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!task.is_completed) setEditingId(task.id);
                            }}
                            className="flex items-center group/title cursor-text min-w-0"
                            title="Klikk for å redigere tittel"
                        >
                            <span className={`text-sm font-medium truncate ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                {task.title}
                            </span>
                            {!task.is_completed && (
                                <Pencil className="w-3 h-3 ml-2 text-slate-300 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                        </div>
                    )}

                    {/* Task Metadata Indicators */}
                    {(task.description || task.due_date) && !task.is_completed && (
                        <div className="flex items-center space-x-2 mt-1">
                            {task.due_date && (
                                <div className={`flex items-center text-[10px] font-bold ${new Date(task.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'text-red-500' : 'text-blue-600'}`}>
                                    <Calendar className="w-3 h-3 mr-0.5" />
                                    {new Date(task.due_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                                </div>
                            )}
                            {task.description && (
                                <AlignLeft className="w-3 h-3 text-slate-400" />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center flex-shrink-0 ml-2">
                <button
                    onClick={() => toggleStar(task.id, task.is_starred)}
                    className={`p-1.5 rounded-lg transition-colors ${task.is_starred ? 'text-yellow-400' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-yellow-400'}`}
                    title={task.is_starred ? 'Fjern stjerne' : 'Stjernemerk'}
                >
                    <Star className="w-4 h-4" fill={task.is_starred ? "currentColor" : "none"} />
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        title="Slett oppgave"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col h-[450px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <div className="bg-blue-50 p-2.5 rounded-xl mr-3">
                        <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">UE Oppgaver</h2>
                        <p className="text-sm font-medium text-slate-500">To-do for underentreprenør</p>
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <select
                    value={selectedSubcontractorId}
                    onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                >
                    <option value="" disabled>Velg underentreprenør...</option>
                    {subcontractors.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                </select>
            </div>

            <form onSubmit={handleAddTask} className="mb-4 relative">
                <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder={selectedSubcontractorId ? "Legg til en UE-oppgave..." : "Velg en UE først..."}
                    disabled={!selectedSubcontractorId}
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-60"
                />
                <button
                    type="submit"
                    disabled={!newTaskTitle.trim() || !selectedSubcontractorId}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </form>

            <div className="flex bg-slate-100 rounded-lg p-1 mb-4 flex-shrink-0">
                <button
                    onClick={() => setActiveTab('idag')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnTab(e, 'idag')}
                    className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${activeTab === 'idag' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    I DAG ({todayTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('imorgen')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnTab(e, 'imorgen')}
                    className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${activeTab === 'imorgen' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    I MORGEN ({tomorrowTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('senere')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnTab(e, 'senere')}
                    className={`flex-1 text-xs font-bold py-2 rounded-md transition-all ${activeTab === 'senere' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                    SENERE ({laterTasks.length})
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
                {!selectedSubcontractorId ? (
                    <div className="text-center py-8 text-slate-400 font-medium text-sm">
                        Velg en underentreprenør for å starte.
                    </div>
                ) : loading ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 font-medium text-sm">
                        Ingen oppgaver lagt til.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1">
                            {currentTasks.length > 0 ? (
                                currentTasks.map(renderTaskItem)
                            ) : (
                                <div className="text-center py-6 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="font-medium text-slate-500">Ingen oppgaver i denne visningen</p>
                                    <p className="mt-1 text-xs">Oppgaver lagt til her får automatisk oppdatert dato</p>
                                </div>
                            )}
                        </div>

                        {completedTasks.length > 0 && (
                            <div className="pt-2">
                                <button
                                    onClick={() => setShowCompleted(!showCompleted)}
                                    className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest pl-2 mb-2 hover:text-slate-600 transition-colors w-full text-left"
                                >
                                    <span className="flex-1">Tidligere ({completedTasks.length})</span>
                                    {showCompleted ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                                </button>

                                {showCompleted && (
                                    <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {completedTasks.map(renderTaskItem)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedTask && (
                <div className="absolute inset-0 bg-white rounded-3xl z-10 flex flex-col shadow-[0_0_15px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden animate-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detaljer</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => toggleStar(selectedTask.id, selectedTask.is_starred)}
                                className={`p-1.5 rounded-lg transition-colors ${selectedTask.is_starred ? 'text-yellow-400 hover:bg-yellow-50' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <Star className="w-5 h-5" fill={selectedTask.is_starred ? "currentColor" : "none"} />
                            </button>
                            <button
                                onClick={() => {
                                    deleteTask(selectedTask.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        <div className="flex items-start space-x-3">
                            <button
                                onClick={() => toggleComplete(selectedTask.id, selectedTask.is_completed)}
                                className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                {selectedTask.is_completed ? (
                                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                                ) : (
                                    <Circle className="w-6 h-6" />
                                )}
                            </button>
                            <textarea
                                value={selectedTask.title}
                                onChange={(e) => setSelectedTask({ ...selectedTask, title: e.target.value })}
                                onBlur={(e) => updateTaskDetails(selectedTask.id, { title: e.target.value })}
                                className={`w-full text-lg font-bold bg-transparent border-none resize-none focus:outline-none focus:ring-0 p-0 overflow-hidden min-h-[1.5em] ${selectedTask.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                rows={Math.max(1, Math.ceil(selectedTask.title.length / 30))}
                                placeholder="Oppgavetittel"
                            />
                        </div>

                        <div className="space-y-4 pl-9">
                            <div className="flex items-center group">
                                <Calendar className="w-5 h-5 text-slate-400 mr-3 group-hover:text-blue-500 transition-colors" />
                                <input
                                    type="date"
                                    value={selectedTask.due_date || ''}
                                    onChange={(e) => updateTaskDetails(selectedTask.id, { due_date: e.target.value || null as any })}
                                    className="bg-transparent border-none text-sm font-medium text-slate-600 focus:ring-0 focus:outline-none px-0 cursor-pointer hover:bg-slate-50 py-1 rounded"
                                />
                                {selectedTask.due_date && (
                                    <button
                                        onClick={() => updateTaskDetails(selectedTask.id, { due_date: null as any })}
                                        className="ml-2 text-xs text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Fjern
                                    </button>
                                )}
                            </div>

                            <div className="flex items-start group">
                                <AlignLeft className="w-5 h-5 text-slate-400 mr-3 mt-1 group-hover:text-blue-500 transition-colors" />
                                <textarea
                                    value={selectedTask.description || ''}
                                    onChange={(e) => setSelectedTask({ ...selectedTask, description: e.target.value })}
                                    onBlur={(e) => updateTaskDetails(selectedTask.id, { description: e.target.value })}
                                    placeholder="Legg til detaljer / notater..."
                                    className="w-full text-sm font-medium text-slate-600 bg-transparent border-none resize-none focus:outline-none focus:ring-0 p-1 hover:bg-slate-50 rounded transition-colors min-h-[100px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
