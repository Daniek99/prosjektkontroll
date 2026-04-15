import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Plus, Map, Building2, Trash2, GripVertical, FileText, UploadCloud, X, Eye } from 'lucide-react';

interface GlobalArea {
    id: string;
    building: string;
    floor: string;
    zone: string;
    description: string;
    floorplan_url?: string;
}

export default function Prosjektoppsett() {
    const [areas, setAreas] = useState<GlobalArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newArea, setNewArea] = useState({ building: '', floorCount: '', zone: '', description: '' });
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Drag and drop state
    const [buildingOrder, setBuildingOrder] = useState<string[]>([]);
    const [draggedBuilding, setDraggedBuilding] = useState<string | null>(null);

    useEffect(() => {
        fetchAreas();
    }, []);

    const fetchAreas = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('global_areas')
            .select('*')
            .order('building', { ascending: true }); // Removed floor sort to do natural sort below

        if (!error && data) {
            // Natural sort floors (Etasje 2 before Etasje 10)
            data.sort((a, b) => (a.floor || '').localeCompare(b.floor || '', undefined, { numeric: true, sensitivity: 'base' }));
            setAreas(data);

            // Establish building order
            const uniqueBuildings = Array.from(new Set(data.map(a => a.building)));
            const savedOrder = JSON.parse(localStorage.getItem('gc-building-order') || '[]');
            const ordered = uniqueBuildings.sort((a, b) => {
                const idxA = savedOrder.indexOf(a);
                const idxB = savedOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });
            setBuildingOrder(ordered);
        }
        setLoading(false);
    };

    const handleAddArea = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const count = parseInt(newArea.floorCount) || 0;
        const areasToInsert = [];

        if (count > 0) {
            // Generate multiple floors
            for (let i = 1; i <= count; i++) {
                areasToInsert.push({
                    building: newArea.building,
                    floor: `Etasje ${i}`,
                    zone: newArea.zone,
                    description: newArea.description
                });
            }
        } else {
            // Just a single building/area
            areasToInsert.push({
                building: newArea.building,
                floor: '',
                zone: newArea.zone,
                description: newArea.description
            });
        }

        const { data, error } = await supabase.from('global_areas').insert(areasToInsert).select();

        if (!error && data) {
            const returnedAreas = data as GlobalArea[];
            const updatedAreas = [...areas, ...returnedAreas].sort((a, b) => {
                if (a.building === b.building) {
                    return (a.floor || '').localeCompare(b.floor || '', undefined, { numeric: true, sensitivity: 'base' });
                }
                return a.building.localeCompare(b.building);
            });
            setAreas(updatedAreas);

            // Update building order if new building
            const newBuildingName = returnedAreas[0]?.building;
            if (newBuildingName && !buildingOrder.includes(newBuildingName)) {
                const newOrder = [...buildingOrder, newBuildingName];
                setBuildingOrder(newOrder);
                localStorage.setItem('gc-building-order', JSON.stringify(newOrder));
            }

            setShowModal(false);
            setNewArea({ building: '', floorCount: '', zone: '', description: '' });
        } else {
            alert('Kunne ikke lagre globalt prosjektområde. Sjekk at databasemigrasjoner er kjørt.');
            console.error(error);
        }
        setIsSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Er du sikker på at du vil slette dette området for hele prosjektet?')) return;

        const { error } = await supabase.from('global_areas').delete().eq('id', id);
        if (!error) {
            setAreas(areas.filter(a => a.id !== id));
        } else {
            alert('Kunne ikke slette området.');
        }
    };

    const handleUpdateArea = async (id: string, field: keyof GlobalArea, value: string) => {
        // Optimistically update
        setAreas(areas.map(a => a.id === id ? { ...a, [field]: value } : a));

        const { error } = await supabase.from('global_areas').update({ [field]: value }).eq('id', id);
        if (error) {
            alert('Kunne ikke oppdatere feltet.');
            fetchAreas(); // rollback
        }
    };

    const handleUpdateBuilding = async (oldBuildingName: string, newBuildingName: string) => {
        if (!newBuildingName.trim() || oldBuildingName === newBuildingName) return;

        // Optimistically update all areas with this building name
        setAreas(areas.map(a => a.building === oldBuildingName ? { ...a, building: newBuildingName } : a));

        // Optimistically update building order
        const newOrder = buildingOrder.map(b => b === oldBuildingName ? newBuildingName : b);
        setBuildingOrder(newOrder);
        localStorage.setItem('gc-building-order', JSON.stringify(newOrder));

        const { error } = await supabase.from('global_areas').update({ building: newBuildingName }).eq('building', oldBuildingName);
        if (error) {
            alert('Kunne ikke oppdatere byggnavn.');
            fetchAreas(); // rollback
        }
    };

    const handleDeleteBuilding = async (buildingName: string) => {
        if (!confirm(`Er du sikker på at du vil slette hele bygget "${buildingName}" og alle tilhørende etasjer/soner?`)) return;

        // Optimistically remove
        setAreas(areas.filter(a => a.building !== buildingName));
        setBuildingOrder(buildingOrder.filter(b => b !== buildingName));

        const { error } = await supabase.from('global_areas').delete().eq('building', buildingName);
        if (error) {
            alert('Kunne ikke slette bygget.');
            fetchAreas(); // rollback
        }
    };

    const handleAddFloorToBuilding = async (buildingName: string) => {
        const newAreaInsert = {
            building: buildingName,
            floor: '',
            zone: '',
            description: ''
        };
        const { data, error } = await supabase.from('global_areas').insert([newAreaInsert]).select();

        if (!error && data) {
            const returnedArea = data[0] as GlobalArea;
            setAreas([...areas, returnedArea]);
        } else {
            alert('Kunne ikke koble til ny etasje.');
        }
    };

    const handleUploadFloorplan = async (areaId: string, file: File) => {
        if (!file.type.includes('pdf')) {
            alert('Vennligst last opp en PDF-fil.');
            return;
        }

        setUploadingId(areaId);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${areaId}-${Math.random().toString(36).substring(2)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('floorplans')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('floorplans')
                .getPublicUrl(fileName);

            // Update database
            const { error: updateError } = await supabase
                .from('global_areas')
                .update({ floorplan_url: publicUrl })
                .eq('id', areaId);

            if (updateError) throw updateError;

            setAreas(areas.map(a => a.id === areaId ? { ...a, floorplan_url: publicUrl } : a));
        } catch (error) {
            console.error('Opplasting feilet:', error);
            alert('Kunne ikke laste opp filen. Sjekk at lagringsbøtten eksisterer og tillatelser er satt.');
        } finally {
            setUploadingId(null);
        }
    };

    const handleRemoveFloorplan = async (areaId: string) => {
        if (!confirm('Er du sikker på at du vil fjerne denne plantegningen?')) return;

        try {
            const { error: updateError } = await supabase
                .from('global_areas')
                .update({ floorplan_url: null })
                .eq('id', areaId);

            if (updateError) throw updateError;

            setAreas(areas.map(a => a.id === areaId ? { ...a, floorplan_url: undefined } : a));
        } catch (error) {
            console.error('Feil ved fjerning:', error);
            alert('Kunne ikke fjerne plantegningen.');
        }
    };

    const groupedAreas = areas.reduce((acc, area) => {
        if (!acc[area.building]) acc[area.building] = [];
        acc[area.building].push(area);
        return acc;
    }, {} as Record<string, GlobalArea[]>);

    const handleDragStart = (e: React.DragEvent, building: string) => {
        setDraggedBuilding(building);
        e.dataTransfer.effectAllowed = 'move';
        // Add a slight delay for visual drag class
        setTimeout(() => {
            (e.target as HTMLElement).classList.add('opacity-40');
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent, building: string) => {
        e.preventDefault();
        if (!draggedBuilding || draggedBuilding === building) return;

        const newOrder = [...buildingOrder];
        const fromIndex = newOrder.indexOf(draggedBuilding);
        const toIndex = newOrder.indexOf(building);

        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedBuilding);

        setBuildingOrder(newOrder);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-40');
        setDraggedBuilding(null);
        localStorage.setItem('gc-building-order', JSON.stringify(buildingOrder));
    };

    return (
        <div className="space-y-6 max-w-full px-4 sm:px-6 lg:px-8 mx-auto pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
                        <Settings className="w-6 h-6 mr-3 text-primary-600" />
                        Prosjektoppsett
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Globale innstillinger og overordnet soneinndeling for prosjektet</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Nytt Globalt Område
                </button>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 tracking-tight flex items-center">
                        <Map className="w-5 h-5 mr-3 text-primary-500" />
                        Prosjektets Soneinndeling
                    </h3>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                    ) : areas.length === 0 ? (
                        <div className="p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Building2 className="w-8 h-8 text-slate-300" />
                            </div>
                            <h4 className="text-lg font-bold text-slate-700 mb-1">Ingen områder definert</h4>
                            <p className="text-slate-500 text-sm max-w-sm">Opprett globale områder (bygg, etasjer) her. Underentreprenører vil deretter kunne knyttes til listene.</p>
                        </div>
                    ) : (
                        <div className="flex gap-6 overflow-x-auto pb-6 px-4 sm:px-6 snap-x pt-6 custom-scrollbar items-start">
                            {buildingOrder.filter(b => groupedAreas[b]).map((buildingName) => {
                                const buildingAreas = groupedAreas[buildingName];
                                return (
                                    <div
                                        key={buildingName}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, buildingName)}
                                        onDragOver={(e) => handleDragOver(e, buildingName)}
                                        onDragEnd={handleDragEnd}
                                        className="shrink-0 w-[420px] bg-white border border-slate-200/60 rounded-3xl shadow-sm flex flex-col snap-start overflow-hidden group/building transition-transform cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="px-5 py-4 bg-slate-50 flex items-center justify-between border-b border-slate-200/60">
                                            <div className="flex items-center flex-1 mr-2">
                                                <GripVertical className="w-5 h-5 mr-3 text-slate-300 group-hover/building:text-slate-500 transition-colors" />
                                                <Building2 className="w-5 h-5 mr-2 text-primary-500 shrink-0" />
                                                <input
                                                    type="text"
                                                    defaultValue={buildingName}
                                                    onBlur={(e) => handleUpdateBuilding(buildingName, e.target.value)}
                                                    className="font-extrabold text-slate-800 text-lg bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg px-2 py-1 outline-none w-full transition-all"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-lg">{buildingAreas.length}</span>
                                                <button onClick={() => handleDeleteBuilding(buildingName)} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 opacity-0 group-hover/building:opacity-100 rounded-lg hover:bg-red-50" title="Slett hele bygget">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                                            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10 shadow-sm border-b border-slate-100">
                                                <div className="col-span-3">Etasje / Plan</div>
                                                <div className="col-span-3">Sone</div>
                                                <div className="col-span-3">Beskrivelse</div>
                                                <div className="col-span-3 text-right">Vedlegg / Valg</div>
                                            </div>
                                            {buildingAreas.map((area) => (
                                                <div key={area.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center bg-white hover:bg-slate-50/50 transition-colors group">
                                                    <div className="col-span-3">
                                                        <input
                                                            type="text"
                                                            value={area.floor || ''}
                                                            onChange={(e) => setAreas(areas.map(a => a.id === area.id ? { ...a, floor: e.target.value } : a))}
                                                            onBlur={(e) => handleUpdateArea(area.id, 'floor', e.target.value)}
                                                            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 transition-all outline-none"
                                                            placeholder="F.eks. U1"
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <input
                                                            type="text"
                                                            value={area.zone || ''}
                                                            onChange={(e) => setAreas(areas.map(a => a.id === area.id ? { ...a, zone: e.target.value } : a))}
                                                            onBlur={(e) => handleUpdateArea(area.id, 'zone', e.target.value)}
                                                            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition-all outline-none"
                                                            placeholder="Legg til..."
                                                        />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <input
                                                            type="text"
                                                            value={area.description || ''}
                                                            onChange={(e) => setAreas(areas.map(a => a.id === area.id ? { ...a, description: e.target.value } : a))}
                                                            onBlur={(e) => handleUpdateArea(area.id, 'description', e.target.value)}
                                                            className="w-full bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition-all outline-none"
                                                            placeholder="Valgfri..."
                                                        />
                                                    </div>
                                                    <div className="col-span-3 flex justify-end items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        {area.floorplan_url ? (
                                                            <div className="flex items-center bg-blue-50 text-blue-600 rounded-lg border border-blue-100 px-2 py-1 relative group/pdf">
                                                                <button onClick={() => setPreviewUrl(area.floorplan_url || null)} className="flex items-center hover:underline text-xs font-bold" title="Forhåndsvis plantegning (PDF)">
                                                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                                                    PDF
                                                                </button>
                                                                <button onClick={() => handleRemoveFloorplan(area.id)} className="ml-2 text-blue-400 hover:text-red-500" title="Fjern PDF">
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <label className={`cursor-pointer p-1.5 rounded-lg transition-colors flex items-center justify-center ${uploadingId === area.id ? 'bg-slate-100 text-slate-400' : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'}`} title="Last opp plantegning (PDF)">
                                                                {uploadingId === area.id ? (
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                                                                ) : (
                                                                    <>
                                                                        <UploadCloud className="w-4 h-4" />
                                                                        <input
                                                                            type="file"
                                                                            accept="application/pdf"
                                                                            className="hidden"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) handleUploadFloorplan(area.id, file);
                                                                            }}
                                                                        />
                                                                    </>
                                                                )}
                                                            </label>
                                                        )}

                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>

                                                        <button onClick={() => handleDelete(area.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Slett område">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-3 bg-slate-50 border-t border-slate-100 mt-auto">
                                            <button
                                                onClick={() => handleAddFloorToBuilding(buildingName)}
                                                className="w-full flex items-center justify-center py-2.5 border-2 border-dashed border-slate-300 text-slate-500 font-bold text-sm rounded-xl hover:bg-white hover:border-primary-400 hover:text-primary-600 transition-all"
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Legg til Etasje / Sone
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Global Area Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Nytt Globalt Område</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleAddArea} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Bygg / Hoveddel <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newArea.building}
                                    onChange={(e) => setNewArea({ ...newArea, building: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="F.eks. Bygg A"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Antall Etasjer</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={newArea.floorCount}
                                        onChange={(e) => setNewArea({ ...newArea, floorCount: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        placeholder="F.eks. 3 (Valgfritt)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Sone</label>
                                    <input
                                        type="text"
                                        value={newArea.zone}
                                        onChange={(e) => setNewArea({ ...newArea, zone: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        placeholder="F.eks. Nord"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Beskrivelse</label>
                                <textarea
                                    rows={2}
                                    value={newArea.description}
                                    onChange={(e) => setNewArea({ ...newArea, description: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="Valgfri beskrivelse..."
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={isSaving} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {isSaving ? 'Lagrer...' : 'Lagre Område'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview PDF Modal */}
            {previewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full h-full max-w-6xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-primary-500" />
                                Forhåndsvisning Plantegning
                            </h3>
                            <div className="flex items-center gap-3">
                                <a href={previewUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary-600 hover:underline">
                                    Åpne i ny fane
                                </a>
                                <button onClick={() => setPreviewUrl(null)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors bg-white border border-slate-200 shadow-sm">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 p-2">
                            <iframe
                                src={previewUrl}
                                className="w-full h-full rounded-2xl border border-slate-200 bg-white"
                                title="PDF Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
