import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { PenTool, Plus, X, Search, Building2, Calendar, FileText, ChevronLeft, ChevronRight, Upload, File as FileIcon, Edit3, Folder, FolderPlus, Trash2, ExternalLink } from 'lucide-react';
import PdfViewer from '../components/PdfViewer';

interface DecisionLog {
    id: string;
    subcontractor_id: string | null;
    area_id: string | null;
    subject: string;
    content: string;
    date: string;
    created_at: string;
    global_areas?: { building: string; floor: string; zone: string; } | null;
    subcontractors?: { company_name: string; } | null;
}

interface EngineeringFolder {
    id: string;
    name: string;
    subcontractor_id: string | null;
}

interface EngineeringFile {
    id: string;
    subcontractor_id: string | null;
    area_id: string | null;
    folder_id: string | null;
    file_url: string;
    file_name: string;
    created_at: string;
}

interface Area { id: string; building: string; floor: string; zone: string; }

export default function Decisions() {
    const { selectedSubcontractorId, subcontractors } = useSubcontractor();
    const [logs, setLogs] = useState<DecisionLog[]>([]);
    const [files, setFiles] = useState<EngineeringFile[]>([]);
    const [folders, setFolders] = useState<EngineeringFolder[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // UI state
    const [showLogModal, setShowLogModal] = useState(false);
    const [editingLog, setEditingLog] = useState<DecisionLog | null>(null);
    const [showFileModal, setShowFileModal] = useState(false);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [previewFile, setPreviewFile] = useState<EngineeringFile | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterAreaId, setFilterAreaId] = useState('');
    const [expandedStacks, setExpandedStacks] = useState<Record<string, boolean>>({});
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    const [logForm, setLogForm] = useState({ subject: '', content: '', date: new Date().toISOString().split('T')[0], subcontractor_id: '', area_id: '' });
    const [folderForm, setFolderForm] = useState({ name: '', subcontractor_id: '' });
    const [fileForm, setFileForm] = useState<{ subcontractor_id: string; folder_id: string; file: File | null; }>({ subcontractor_id: '', folder_id: '', file: null });

    useEffect(() => { fetchData(); }, [selectedSubcontractorId]);

    const fetchData = async () => {
        setLoading(true);
        const { data: areasData } = await supabase.from('global_areas').select('*');
        if (areasData) setAreas(areasData);

        let logQuery = supabase.from('decision_logs').select(`*, global_areas(building, floor, zone), subcontractors(company_name)`).order('date', { ascending: false });
        let fileQuery = supabase.from('engineering_files').select('*').order('created_at', { ascending: false });
        let folderQuery = supabase.from('engineering_folders').select('*').order('created_at', { ascending: true });

        if (selectedSubcontractorId) {
            logQuery = logQuery.eq('subcontractor_id', selectedSubcontractorId);
            fileQuery = fileQuery.eq('subcontractor_id', selectedSubcontractorId);
            folderQuery = folderQuery.eq('subcontractor_id', selectedSubcontractorId);
        }

        const [logsRes, filesRes, foldersRes] = await Promise.all([logQuery, fileQuery, folderQuery]);
        if (logsRes.data) setLogs(logsRes.data as unknown as DecisionLog[]);
        if (filesRes.data) setFiles(filesRes.data as EngineeringFile[]);
        if (foldersRes.data) setFolders(foldersRes.data as EngineeringFolder[]);
        
        setLoading(false);
    };

    const handleSaveLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const payload = { subject: logForm.subject, content: logForm.content, date: logForm.date, subcontractor_id: logForm.subcontractor_id || null, area_id: logForm.area_id || null };
        if (editingLog) {
            const { error } = await supabase.from('decision_logs').update(payload).eq('id', editingLog.id);
            if (error) alert('Kunne ikke oppdatere logg: ' + error.message);
        } else {
            const { error } = await supabase.from('decision_logs').insert([payload]);
            if (error) alert('Kunne ikke lagre logg: ' + error.message);
        }
        fetchData();
        setShowLogModal(false);
        setEditingLog(null);
        setLogForm({ subject: '', content: '', date: new Date().toISOString().split('T')[0], subcontractor_id: '', area_id: '' });
        setLoading(false);
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.from('engineering_folders').insert([{ name: folderForm.name, subcontractor_id: folderForm.subcontractor_id || null }]);
        if (error) alert('Kunne ikke opprette mappe: ' + error.message);
        else {
            fetchData();
            setShowFolderModal(false);
            setFolderForm({ name: '', subcontractor_id: '' });
        }
        setLoading(false);
    };

    const handleUploadFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileForm.file) return;
        setUploading(true);
        const fileExt = fileForm.file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('engineering').upload(fileName, fileForm.file, {
            contentType: fileForm.file.type,
            upsert: false
        });

        if (uploadError) {
            alert('Feil ved opplasting av fil: ' + uploadError.message);
            setUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage.from('engineering').getPublicUrl(fileName);
        const { error: dbError } = await supabase.from('engineering_files').insert([{
            file_name: fileForm.file.name,
            file_url: urlData.publicUrl,
            subcontractor_id: fileForm.subcontractor_id || null,
            folder_id: fileForm.folder_id || null
        }]);

        if (dbError) alert('Kunne ikke lagre filreferanse: ' + dbError.message);
        else {
            fetchData();
            setShowFileModal(false);
            setFileForm({ subcontractor_id: '', folder_id: '', file: null });
        }
        setUploading(false);
    };

    const handleDeleteFile = async (id: string, fileUrl: string) => {
        if (!confirm('Er du sikker på at du vil slette denne filen?')) return;
        
        try {
            const fileName = fileUrl.split('/').pop();
            if (fileName) {
                await supabase.storage.from('engineering').remove([fileName]);
            }
            const { error } = await supabase.from('engineering_files').delete().eq('id', id);
            if (error) throw error;
            setFiles(prev => prev.filter(f => f.id !== id));
        } catch (error: any) {
            alert('Feil ved sletting: ' + error.message);
        }
    };

    const openEditLog = (log: DecisionLog) => {
        setEditingLog(log);
        setLogForm({ subject: log.subject, content: log.content, date: log.date, subcontractor_id: log.subcontractor_id || '', area_id: log.area_id || '' });
        setShowLogModal(true);
    };

    const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -350, behavior: 'smooth' });
    const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 350, behavior: 'smooth' });

    const toggleStack = (subName: string, e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setExpandedStacks(prev => ({ ...prev, [subName]: !prev[subName] }));
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.subject.toLowerCase().includes(searchTerm.toLowerCase()) || log.content?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesArea = filterAreaId ? log.area_id === filterAreaId : true;
        return matchesSearch && matchesArea;
    });

    const logsBySubcontractor = filteredLogs.reduce((acc, log) => {
        const subName = log.subcontractors?.company_name || 'Generelt / Ukjent';
        if (!acc[subName]) acc[subName] = { subId: log.subcontractor_id, logs: [], files: [], folders: [] };
        acc[subName].logs.push(log);
        return acc;
    }, {} as Record<string, { subId: string | null, logs: DecisionLog[], files: EngineeringFile[], folders: EngineeringFolder[] }>);
    
    // Attach files and folders to proper groups
    subcontractors.forEach(sub => {
        if (!logsBySubcontractor[sub.company_name]) {
            logsBySubcontractor[sub.company_name] = { subId: sub.id, logs: [], files: [], folders: [] };
        }
    });

    files.forEach(file => {
        const subMatch = subcontractors.find(s => s.id === file.subcontractor_id);
        const subName = subMatch?.company_name || 'Generelt / Ukjent';
        if (!logsBySubcontractor[subName]) logsBySubcontractor[subName] = { subId: file.subcontractor_id, logs: [], files: [], folders: [] };
        logsBySubcontractor[subName].files.push(file);
    });

    folders.forEach(folder => {
        const subMatch = subcontractors.find(s => s.id === folder.subcontractor_id);
        const subName = subMatch?.company_name || 'Generelt / Ukjent';
        if (!logsBySubcontractor[subName]) logsBySubcontractor[subName] = { subId: folder.subcontractor_id, logs: [], files: [], folders: [] };
        logsBySubcontractor[subName].folders.push(folder);
    });

    const sortedSubcontractors = Object.keys(logsBySubcontractor).sort((a, b) => {
        if (a === 'Generelt / Ukjent') return 1;
        if (b === 'Generelt / Ukjent') return -1;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)] max-w-[1700px] mx-auto p-4 sm:p-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 shrink-0">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
                        <PenTool className="w-7 h-7 mr-3 text-primary-600" />
                        Prosjektering
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Styr dokumenter, mapper og beslutninger per fag</p>
                </div>
            </div>

            {loading && logs.length === 0 && files.length === 0 ? (
                <div className="p-12 flex justify-center flex-1 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : sortedSubcontractors.length === 0 ? (
                <div className="bg-white p-12 text-center text-slate-500 font-medium border border-slate-200 rounded-3xl shadow-sm flex-1 flex items-center justify-center">
                    Ingen underentreprenører valgt eller loggført enda.
                </div>
            ) : (
                <div className="relative flex-1 min-h-0 min-w-0 flex">
                    <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-50/50 to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50/50 to-transparent z-10 pointer-events-none" />
                    
                    <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-20">
                         <button onClick={scrollLeft} className="bg-white p-2 rounded-full shadow-lg border border-slate-200 text-slate-600 hover:text-primary-600 hover:scale-110 transition-all hidden md:block">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-20">
                        <button onClick={scrollRight} className="bg-white p-2 rounded-full shadow-lg border border-slate-200 text-slate-600 hover:text-primary-600 hover:scale-110 transition-all hidden md:block">
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>

                    <div 
                        ref={scrollContainerRef}
                        className="flex gap-6 overflow-x-auto h-full pb-4 snap-x snap-mandatory flex-1 [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {sortedSubcontractors.map((subName) => {
                            const data = logsBySubcontractor[subName];
                            const isExpanded = expandedStacks[subName] || false;
                            
                            // Organize files by folders
                            const rootFiles = data.files.filter(f => !f.folder_id);
                            const foldersWithFiles = data.folders.map(folder => ({
                                ...folder,
                                files: data.files.filter(f => f.folder_id === folder.id)
                            }));

                            return (
                                <div key={subName} className="flex-none w-full sm:w-[400px] lg:w-[450px] h-full flex flex-col bg-slate-100/50 rounded-3xl border border-slate-200 p-4 snap-start relative">
                                    <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                                        <h2 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-primary-600" />
                                            <span className="truncate">{subName}</span>
                                        </h2>
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-8 pr-1 pb-12 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                        
                                        {/* My Files Section */}
                                        <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)] border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                                                <h3 className="text-sm font-bold text-slate-800 flex items-center">
                                                    <FileIcon className="w-4 h-4 mr-2 text-primary-500" />
                                                    Mine filer
                                                </h3>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setFolderForm({...folderForm, subcontractor_id: data.subId || ''}); setShowFolderModal(true); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg hover:text-primary-600 transition-colors" title="Ny Mappe">
                                                        <FolderPlus className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => { setFileForm({...fileForm, subcontractor_id: data.subId || ''}); setShowFileModal(true); }} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg hover:text-primary-600 transition-colors" title="Ny Fil">
                                                        <Upload className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Folder List */}
                                            <div className="space-y-3">
                                                {foldersWithFiles.map(folder => (
                                                    <div key={folder.id} className="border border-slate-100 rounded-xl overflow-hidden group">
                                                        <div className="bg-slate-50 px-3 py-2.5 flex items-center gap-2">
                                                            <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />
                                                            <span className="text-sm font-bold text-slate-700 truncate">{folder.name}</span>
                                                            <span className="ml-auto text-[10px] font-bold text-slate-400 bg-white px-2 rounded-md">{folder.files.length}</span>
                                                        </div>
                                                        <div className="bg-white p-2 flex flex-col gap-1">
                                                            {folder.files.length === 0 ? (
                                                                <span className="text-xs text-slate-400 italic px-2">Tom mappe</span>
                                                            ) : folder.files.map(file => (
                                                                <div key={file.id} className="group flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-primary-600 hover:bg-primary-50 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-primary-100">
                                                                    <button onClick={() => setPreviewFile(file)} className="flex items-center truncate flex-1 text-left">
                                                                        <FileText className="w-3 h-3 mr-1.5 text-slate-400 shrink-0" />
                                                                        <span className="truncate">{file.file_name}</span>
                                                                    </button>
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-primary-700 hover:bg-primary-100 rounded transition-colors" title="Åpne i ny fane">
                                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                                        </a>
                                                                        <button onClick={() => handleDeleteFile(file.id, file.file_url)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Slett fil">
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Root files */}
                                                {rootFiles.length > 0 && (
                                                    <div className="pt-2 flex flex-col gap-1">
                                                        {rootFiles.map(file => (
                                                            <div key={file.id} className="group flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-colors border border-slate-100 hover:border-primary-200">
                                                                <button onClick={() => setPreviewFile(file)} className="flex items-center truncate flex-1 text-left">
                                                                    <FileText className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                                                                    <span className="truncate">{file.file_name}</span>
                                                                </button>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                                    <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-primary-700 hover:bg-primary-100 rounded transition-colors" title="Åpne i ny fane">
                                                                        <ExternalLink className="w-4 h-4" />
                                                                    </a>
                                                                    <button onClick={() => handleDeleteFile(file.id, file.file_url)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Slett fil">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {foldersWithFiles.length === 0 && rootFiles.length === 0 && (
                                                    <div className="text-center py-4">
                                                        <span className="text-xs font-medium text-slate-400">Ingen filer lastet opp enda.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Decision Logs Section */}
                                        <div className="relative">
                                            {/* Toolbar for logs */}
                                            <div className="flex flex-col gap-2 mb-6 sticky top-0 bg-slate-100/90 backdrop-blur z-30 pt-1 pb-3 px-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-bold text-slate-800 flex items-center">
                                                        <FileText className="w-4 h-4 mr-2 text-primary-500" />
                                                        Beslutningslogg
                                                    </h3>
                                                    <button onClick={() => { setEditingLog(null); setLogForm({...logForm, subcontractor_id: data.subId || ''}); setShowLogModal(true); }} className="text-primary-600 hover:bg-primary-50 p-1.5 rounded-lg transition-colors" title="Nytt Logginnlegg">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input type="text" placeholder="Søk logg..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary-500/50 w-full" />
                                                    </div>
                                                    <select value={filterAreaId} onChange={(e) => setFilterAreaId(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary-500/50 max-w-[100px]">
                                                        <option value="">Område</option>
                                                        {areas.map(a => (<option key={a.id} value={a.id}>{a.building}</option>))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Decision Logs Stack List */}
                                            {data.logs.length > 0 ? (
                                                <div className="relative" onClick={(e) => toggleStack(subName, e)}>
                                                    
                                                    <div className={`relative transition-all duration-500 ease-out ${isExpanded ? 'space-y-4' : ''}`} style={!isExpanded ? { height: 160 } : undefined}>
                                                        {data.logs.map((log, index) => {
                                                            const isTop = index === 0;
                                                            const isSecond = index === 1;
                                                            const isThird = index === 2;
                                                            
                                                            let offset = 0; let scale = 1; let zIndex = data.logs.length - index; let opacity = 1; let pointerEvents: 'auto' | 'none' = 'auto';

                                                            if (!isExpanded) {
                                                                pointerEvents = isTop ? 'auto' : 'none';
                                                                if (isSecond) { offset = 12; scale = 0.96; } 
                                                                else if (isThird) { offset = 24; scale = 0.92; } 
                                                                else if (!isTop) { opacity = 0; offset = 30; scale = 0.9; }
                                                            }

                                                            if (!isExpanded && index > 2) return null;

                                                            return (
                                                                <div 
                                                                    key={log.id} 
                                                                    className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 group flex flex-col transition-all duration-500 ${!isExpanded ? 'absolute top-0 left-0 right-0 cursor-pointer hover:-translate-y-1' : 'relative'}`}
                                                                    style={!isExpanded ? {
                                                                        transform: `translateY(${offset}px) scale(${scale})`, zIndex, opacity, pointerEvents,
                                                                        boxShadow: isTop ? '0 10px 25px -5px rgba(0,0,0,0.05), border-b border-r' : '0 1px 3px rgba(0,0,0,0.05)'
                                                                    } : undefined}
                                                                >
                                                                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3 shrink-0">
                                                                        <div className="flex items-center text-slate-500 font-bold text-xs bg-slate-50 px-2.5 py-1 rounded-lg">
                                                                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary-500" />
                                                                            {new Date(log.date).toLocaleDateString('no-NO')}
                                                                        </div>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); openEditLog(log); }} 
                                                                            className={`text-slate-400 hover:text-primary-600 transition-colors p-1 bg-slate-50 rounded-lg hover:bg-primary-50 ${(!isExpanded && !isTop) ? 'hidden' : 'block'}`}
                                                                        >
                                                                            <Edit3 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                    <h3 className="text-base font-extrabold text-slate-800 mb-2 leading-snug truncate">{log.subject}</h3>
                                                                    <p className={`text-slate-600 text-sm whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>{log.content}</p>

                                                                    {log.global_areas && (
                                                                        <div className="flex items-center text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl mt-4 shrink-0 border border-slate-100 w-fit">
                                                                            <FileText className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                                                            <span className="truncate">{log.global_areas.building}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    
                                                    {!isExpanded && data.logs.length > 1 && (
                                                        <div className="text-center mt-6">
                                                            <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full animate-pulse cursor-pointer">
                                                                Klikk for å se hele ({data.logs.length})
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-white/50 border border-dashed border-slate-300 rounded-2xl p-6 text-center">
                                                    <span className="text-xs font-bold text-slate-400">Ingen logger enda.</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal for Log */}
            {showLogModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                {editingLog ? <Edit3 className="w-5 h-5 mr-2 text-slate-400" /> : <PenTool className="w-5 h-5 mr-2 text-slate-400" />}
                                {editingLog ? 'Rediger Innlegg' : 'Nytt Innlegg'}
                            </h3>
                            <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSaveLog} className="p-6 space-y-5">
                            ... existing form HTML replaced for brevity here ...
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Emne</label>
                                <input type="text" required value={logForm.subject} onChange={(e) => setLogForm({ ...logForm, subject: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Dato</label>
                                    <input type="date" required value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fag</label>
                                    <select value={logForm.subcontractor_id} onChange={(e) => setLogForm({ ...logForm, subcontractor_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50">
                                        <option value="">(Ingen)</option>
                                        {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Område</label>
                                    <select value={logForm.area_id} onChange={(e) => setLogForm({ ...logForm, area_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium focus:ring-2 focus:ring-primary-500/50">
                                        <option value="">(Generelt)</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.building}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Innhold</label>
                                <textarea required rows={6} value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium focus:ring-2 focus:ring-primary-500/50" />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowLogModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50">Avbryt</button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 disabled:opacity-50">Lagre</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Folder */}
            {showFolderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center"><FolderPlus className="w-5 h-5 mr-2 text-slate-400" /> Ny Mappe</h3>
                            <button onClick={() => setShowFolderModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleCreateFolder} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Mappenavn</label>
                                <input type="text" required value={folderForm.name} onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium" placeholder="F.eks: Tegninger..." />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowFolderModal(false)} className="flex-1 px-4 py-3 bg-white border text-center font-bold rounded-xl hover:bg-slate-50">Avbryt</button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-900 disabled:opacity-50">Lagre</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for File Upload */}
            {showFileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center"><Upload className="w-5 h-5 mr-2 text-slate-400" /> Last opp Fil</h3>
                            <button onClick={() => setShowFileModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleUploadFile} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Gjelder Fag</label>
                                <select required value={fileForm.subcontractor_id} onChange={(e) => setFileForm({ ...fileForm, subcontractor_id: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 font-medium">
                                    <option value="">Velg underentreprenør...</option>
                                    {subcontractors.map(sub => <option key={sub.id} value={sub.id}>{sub.company_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Velg Mappe</label>
                                <select value={fileForm.folder_id} onChange={(e) => setFileForm({ ...fileForm, folder_id: e.target.value })} className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-2.5 font-medium">
                                    <option value="">(Ingen mappe - Rotnivå)</option>
                                    {folders.filter(f => f.subcontractor_id === fileForm.subcontractor_id || !fileForm.subcontractor_id).map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Fil</label>
                                <input type="file" required onChange={(e) => setFileForm({...fileForm, file: e.target.files?.[0] || null})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowFileModal(false)} className="flex-1 px-4 py-3 bg-white border text-center font-bold rounded-xl hover:bg-slate-50">Avbryt</button>
                                <button disabled={uploading || !fileForm.file} type="submit" className="flex-1 px-4 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-900 disabled:opacity-50">{uploading ? 'Laster opp...' : 'Lagre Fil'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {previewFile && (
                <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-extrabold text-slate-800">{previewFile.file_name}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <a
                                href={previewFile.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-primary-50 border border-primary-100 text-primary-700 text-sm font-bold rounded-xl hover:bg-primary-100 transition-all flex items-center gap-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Åpne i ny fane
                            </a>
                            <button
                                onClick={() => setPreviewFile(null)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden bg-slate-100 flex justify-center items-center relative">
                        {previewFile.file_name.toLowerCase().endsWith('.pdf') || previewFile.file_url.toLowerCase().includes('.pdf') ? (
                            <PdfViewer url={previewFile.file_url} />
                        ) : (
                            <iframe
                                src={previewFile.file_url}
                                className="w-full h-full border-none bg-white"
                                title={previewFile.file_name}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
