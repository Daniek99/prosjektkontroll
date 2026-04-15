import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Map, MapPin, Building, Layers, CheckSquare, Square } from 'lucide-react';

interface GlobalArea {
    id: string;
    building: string;
    floor: string;
    zone: string;
    description: string;
}

export default function Areas() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [globalAreas, setGlobalAreas] = useState<GlobalArea[]>([]);
    const [assignedAreaIds, setAssignedAreaIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedSubcontractorId) return;

        async function loadAreas() {
            setLoading(true);

            // Fetch all global areas defined in the project
            const { data: areasData } = await supabase
                .from('global_areas')
                .select('*')
                .order('building', { ascending: true })
                .order('floor', { ascending: true })
                .order('zone', { ascending: true });

            // Fetch which ones are assigned to this subcontractor
            const { data: assignedData } = await supabase
                .from('subcontractor_areas')
                .select('global_area_id')
                .eq('subcontractor_id', selectedSubcontractorId);

            setGlobalAreas(areasData || []);
            setAssignedAreaIds(new Set((assignedData || []).map(a => a.global_area_id)));
            setLoading(false);
        }
        loadAreas();
    }, [selectedSubcontractorId]);

    const toggleAreaAssignment = async (globalAreaId: string) => {
        const isAssigned = assignedAreaIds.has(globalAreaId);
        const newSet = new Set(assignedAreaIds);

        if (isAssigned) {
            newSet.delete(globalAreaId);
            setAssignedAreaIds(newSet);
            await supabase
                .from('subcontractor_areas')
                .delete()
                .eq('subcontractor_id', selectedSubcontractorId)
                .eq('global_area_id', globalAreaId);
        } else {
            newSet.add(globalAreaId);
            setAssignedAreaIds(newSet);
            await supabase
                .from('subcontractor_areas')
                .insert([{ subcontractor_id: selectedSubcontractorId, global_area_id: globalAreaId }]);
        }
    };

    const toggleBuildingAreas = async (floors: Record<string, GlobalArea[]>) => {
        if (!selectedSubcontractorId) return;

        const allAreasInBuilding = Object.values(floors).flat();
        const allAreaIds = allAreasInBuilding.map(a => a.id);
        const allSelected = allAreaIds.every(id => assignedAreaIds.has(id));

        const newSet = new Set(assignedAreaIds);

        if (allSelected) {
            // Deselect all
            allAreaIds.forEach(id => newSet.delete(id));
            setAssignedAreaIds(newSet);
            await supabase
                .from('subcontractor_areas')
                .delete()
                .eq('subcontractor_id', selectedSubcontractorId)
                .in('global_area_id', allAreaIds);
        } else {
            // Select all missing
            const toInsert = allAreaIds
                .filter(id => !assignedAreaIds.has(id))
                .map(id => ({ subcontractor_id: selectedSubcontractorId, global_area_id: id }));

            allAreaIds.forEach(id => newSet.add(id));
            setAssignedAreaIds(newSet);

            if (toInsert.length > 0) {
                await supabase
                    .from('subcontractor_areas')
                    .insert(toInsert);
            }
        }
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <Map className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å definere prosjektområder.</p>
            </div>
        );
    }

    // Group global areas by building and floor for better display
    const groupedAreas = globalAreas.reduce((acc, area) => {
        if (!acc[area.building]) acc[area.building] = {};
        if (!acc[area.building][area.floor || 'Generelt']) acc[area.building][area.floor || 'Generelt'] = [];
        acc[area.building][area.floor || 'Generelt'].push(area);
        return acc;
    }, {} as Record<string, Record<string, GlobalArea[]>>);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Tildel Områder</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Velg hvilke av prosjektets områder som er relevante for denne underentreprenøren</p>
                </div>
            </div>

            {loading ? (
                <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
            ) : globalAreas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                    <div className="bg-slate-50 p-6 rounded-full mb-6">
                        <MapPin className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Ingen områder definert i prosjektet</h3>
                    <p className="text-slate-500 text-center mt-2 font-medium">Gå til "Prosjektoppsett" for å opprette globale områder før du kan tildele dem her.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(groupedAreas).map(([building, floors]) => (
                        <div key={building} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/60">
                            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Building className="w-5 h-5 text-slate-500" />
                                    <h3 className="font-extrabold text-slate-800 tracking-tight">{building}</h3>
                                </div>
                                <button
                                    onClick={() => toggleBuildingAreas(floors)}
                                    className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
                                >
                                    {Object.values(floors).flat().every(a => assignedAreaIds.has(a.id)) ? 'Fjern alle' : 'Velg alle'}
                                </button>
                            </div>
                            <div className="p-2">
                                {Object.entries(floors).map(([floor, floorAreas]) => (
                                    <div key={floor} className="mb-4 last:mb-0">
                                        <h4 className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary-600 uppercase tracking-widest bg-primary-50/50 rounded-lg mb-2">
                                            <Layers className="w-3.5 h-3.5" />
                                            Etasje: {floor}
                                        </h4>
                                        <div className="space-y-2 px-3">
                                            {floorAreas.map(area => {
                                                const isAssigned = assignedAreaIds.has(area.id);
                                                return (
                                                    <div
                                                        key={area.id}
                                                        onClick={() => toggleAreaAssignment(area.id)}
                                                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all group ${isAssigned ? 'border-primary-400 bg-primary-50/30' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        <div className={`mt-0.5 transition-colors ${isAssigned ? 'text-primary-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                                            {isAssigned ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                                {area.zone || 'Hovedsone'}
                                                            </div>
                                                            {area.description && <div className="text-xs text-slate-500 mt-0.5">{area.description}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
