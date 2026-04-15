import { useEffect, useState, useRef } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Camera, MapPin, Image as ImageIcon, Plus, X, UploadCloud, Calendar as CalendarIcon, Pencil, Trash2, EyeOff, Eye, Edit2 } from 'lucide-react';

interface ProjectArea {
    id: string;
    building: string;
    floor: string;
    zone: string;
    description: string;
}

interface CellData {
    status: 'not_started' | 'in_progress' | 'completed';
    actualStart?: string;
    actualEnd?: string;
    comment?: string;
}

interface GridDataRow { id: string; label: string; hidden?: boolean; }
interface GridDataCol { id: string; label: string; hidden?: boolean; }

interface GridData {
    rows: GridDataRow[];
    columns: GridDataCol[];
    cells: Record<string, any>; // legacy colors or CellData
    trades: { name: string, color: string }[];
}

const getIsoWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

interface ProgressPlan {
    id: string;
    name: string;
    grid: GridData;
}

interface PlansData {
    activePlanId: string;
    plans: ProgressPlan[];
}

const defaultGrid: GridData = {
    rows: [
        { id: 'r1', label: 'Bygg A - Plan 1' },
        { id: 'r2', label: 'Bygg A - Plan 2' }
    ],
    columns: [
        { id: 'c1', label: 'Uke 32' },
        { id: 'c2', label: 'Uke 33' },
        { id: 'c3', label: 'Uke 34' }
    ],
    cells: {},
    trades: [
        { name: 'Tømrer', color: '#ef4444' }, // red
        { name: 'Elektriker', color: '#eab308' }, // yellow
        { name: 'Rørlegger', color: '#3b82f6' }, // blue
        { name: 'Maler', color: '#22c55e' }, // green
        { name: 'Ventilasjon', color: '#a855f7' } // purple
    ]
};

const inferNextColLabel = (columns: { id: string, label: string }[]) => {
    if (columns.length === 0) return "Uke 1";
    const lastLabel = columns[columns.length - 1].label;

    // Assume it's a week and wrap at 52, UNLESS the user uses words like "Periode", "Måned", "Dag".
    const isCustomNonWrapping = /periode|måned|mnd|dag|uke\s*ikke/i.test(lastLabel);

    const numMatch = lastLabel.match(/(\d+)/);
    if (numMatch) {
        let num = parseInt(numMatch[1], 10);
        num += 1;
        if (!isCustomNonWrapping && num > 52) {
            num = 1;
        }
        return lastLabel.replace(numMatch[1], num.toString());
    }

    return "Ny Uke";
};

const inferNextRowLabel = (rows: { id: string, label: string }[]) => {
    if (rows.length === 0) return "Ny Etasje";
    const lastLabel = rows[rows.length - 1].label;
    const match = lastLabel.match(/(\d+)(?!.*\d)/);
    if (match) {
        let num = parseInt(match[1], 10);
        let delta = -1;
        if (rows.length >= 2) {
            const prevLabel = rows[rows.length - 2].label;
            const prevMatch = prevLabel.match(/(\d+)(?!.*\d)/);
            if (prevMatch) {
                const prevNum = parseInt(prevMatch[1], 10);
                delta = num - prevNum;
            }
        }
        if (delta === 0) delta = 1;
        return lastLabel.replace(match[1], (num + delta).toString());
    }
    return lastLabel + " (Kopi)";
};

const defaultPlansData: PlansData = {
    activePlanId: 'plan-1',
    plans: [
        {
            id: 'plan-1',
            name: 'Hovedplan',
            grid: defaultGrid
        }
    ]
};

export default function Progress() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [subcontractors, setSubcontractors] = useState<any[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [areas, setAreas] = useState<ProjectArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAreaPickerModal, setShowAreaPickerModal] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [plansData, setPlansData] = useState<PlansData>(defaultPlansData);
    const [selectedCell, setSelectedCell] = useState<{ rowId: string, colId: string } | null>(null);
    const [cellFormData, setCellFormData] = useState<CellData | null>(null);
    const [cellPopoverPos, setCellPopoverPos] = useState<{ top: number, left: number } | null>(null);
    const [selectionStart, setSelectionStart] = useState<{ rIdx: number, cIdx: number } | null>(null);
     const [selectionEnd, setSelectionEnd] = useState<{ rIdx: number, cIdx: number } | null>(null);
     const [isSelecting, setIsSelecting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const [projectPlans, setProjectPlans] = useState<{ id: string, name: string, file_url: string }[]>([]);
    const [showUploadPlanModal, setShowUploadPlanModal] = useState(false);
    const [showViewPlansModal, setShowViewPlansModal] = useState(false);
    const [uploadPlanName, setUploadPlanName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadingPlan, setUploadingPlan] = useState(false);
    const [previewPlan, setPreviewPlan] = useState<{ name: string, file_url: string } | null>(null);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [newPlanData, setNewPlanData] = useState({ name: '', type: 'week', startWeek: getIsoWeek(new Date()) });
    const [newPhoto, setNewPhoto] = useState<{ id?: string, area: string, area_id: string, photo_url: string, notes: string, date: string }>({ area: '', area_id: '', photo_url: '', notes: '', date: new Date().toISOString().split('T')[0] });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activePlan = plansData.plans.find(p => p.id === plansData.activePlanId) || plansData.plans[0] || defaultPlansData.plans[0];
    const gridData = activePlan?.grid || defaultGrid;

    const cellDragRef = useRef<{ startRIdx: number, startCIdx: number, originalSelectionStart: {rIdx: number, cIdx: number} | null, originalSelectionEnd: {rIdx: number, cIdx: number} | null } | null>(null);
    const isDraggingRef = useRef<{ type: 'row' | 'col', startX: number, startY: number, addedCount: number, initialRows: { id: string, label: string }[], initialCols: { id: string, label: string }[] } | null>(null);
    const plansDataRef = useRef(plansData);
    const gridDataRef = useRef(gridData);
    const historyRef = useRef<PlansData[]>([]);
    const historyIndexRef = useRef<number>(-1);

    useEffect(() => {
        plansDataRef.current = plansData;
        gridDataRef.current = gridData;
    }, [plansData, gridData]);

    const handlePointerMove = (e: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const drag = isDraggingRef.current;
        const ROW_HEIGHT = 48;
        const COL_WIDTH = 100;

        if (drag.type === 'row') {
            const dy = e.clientY - drag.startY;
            const targetCount = Math.max(0, Math.floor(dy / ROW_HEIGHT));
            if (targetCount !== drag.addedCount) {
                let currentRows = [...drag.initialRows];
                for (let i = 0; i < targetCount; i++) {
                    const newLabel = inferNextRowLabel(currentRows);
                    currentRows.push({ id: `r_auto_${Date.now()}_${i} `, label: newLabel });
                }
                saveGrid({ ...gridDataRef.current, rows: currentRows }, true);
                drag.addedCount = targetCount;
            }
        } else if (drag.type === 'col') {
            const dx = e.clientX - drag.startX;
            const targetCount = Math.max(0, Math.floor(dx / COL_WIDTH));
            if (targetCount !== drag.addedCount) {
                let currentCols = [...drag.initialCols];
                for (let i = 0; i < targetCount; i++) {
                    const newLabel = inferNextColLabel(currentCols);
                    currentCols.push({ id: `c_auto_${Date.now()}_${i} `, label: newLabel });
                }
                saveGrid({ ...gridDataRef.current, columns: currentCols }, true);
                drag.addedCount = targetCount;
            }
        }
    };

    const handlePointerUp = async () => {
        if (isDraggingRef.current?.addedCount && isDraggingRef.current?.addedCount > 0) {
            await supabase.from('project_progress_grid').upsert({
                subcontractor_id: selectedSubcontractorId,
                grid_data: plansDataRef.current as any,
                updated_at: new Date().toISOString()
            }, { onConflict: 'subcontractor_id' });
        }
        isDraggingRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
    };

    const startDrag = (e: React.PointerEvent, type: 'row' | 'col') => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            addedCount: 0,
            initialRows: gridData.rows,
            initialCols: gridData.columns
        };
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    useEffect(() => {
        if (!selectedSubcontractorId) return;

        async function loadData() {
            const { data: subsData } = await supabase.from('subcontractors').select('id, company_name');
            if (subsData) setSubcontractors(subsData);

            const { data: plansDataRes } = await supabase.from('project_progress_plans').select('*').order('created_at', { ascending: false });
            if (plansDataRes) setProjectPlans(plansDataRes);

            const { data: photoData } = await supabase
                .from('progress_photos')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('date', { ascending: false });

            const { data: globalAreaData } = await supabase
                .from('global_areas')
                .select('*')
                .order('building', { ascending: true })
                .order('floor', { ascending: true })
                .order('zone', { ascending: true });

            const { data: assignedData } = await supabase
                .from('subcontractor_areas')
                .select('global_area_id')
                .eq('subcontractor_id', selectedSubcontractorId);

            const assignedIds = new Set((assignedData || []).map(a => a.global_area_id));
            const areaData = (globalAreaData || []).filter(area => assignedIds.has(area.id));

            const { data: gridRes } = await supabase
                .from('project_progress_grid')
                .select('grid_data')
                .eq('subcontractor_id', selectedSubcontractorId)
                .maybeSingle();

            if (photoData) setPhotos(photoData);
            if (areaData) setAreas(areaData);
            if (gridRes && gridRes.grid_data) {
                const gData = gridRes.grid_data as any;
                if (gData.plans) {
                    setPlansData(gData);
                    historyRef.current = [gData];
                    historyIndexRef.current = 0;
                } else {
                    // Legacy upgrade
                    const upgradedData = {
                        activePlanId: 'plan-orig',
                        plans: [
                            {
                                id: 'plan-orig',
                                name: 'Hovedplan',
                                grid: {
                                    rows: gData.rows || defaultGrid.rows,
                                    columns: gData.columns || defaultGrid.columns,
                                    cells: gData.cells || {},
                                    trades: gData.trades || defaultGrid.trades
                                }
                            }
                        ]
                    };
                    setPlansData(upgradedData);
                    historyRef.current = [upgradedData];
                    historyIndexRef.current = 0;
                }
            } else {
                setPlansData(defaultPlansData);
                historyRef.current = [defaultPlansData];
                historyIndexRef.current = 0;
            }
            setLoading(false);
        }
        loadData();
    }, [selectedSubcontractorId]);

    const savePlansData = async (newPlansData: PlansData, skipSupabase = false, isUndo = false) => {
        setPlansData(newPlansData);
        
        if (!isUndo) {
            const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
            newHistory.push(newPlansData);
            if (newHistory.length > 50) newHistory.shift();
            historyRef.current = newHistory;
            historyIndexRef.current = newHistory.length - 1;
        }

        if (!skipSupabase) {
            await supabase.from('project_progress_grid').upsert({
                subcontractor_id: selectedSubcontractorId,
                grid_data: newPlansData as any,
                updated_at: new Date().toISOString()
            }, { onConflict: 'subcontractor_id' });
        }
    };

    const saveGrid = async (newGrid: GridData, skipSupabase = false) => {
        const newPlans = plansData.plans.map(p => p.id === plansData.activePlanId ? { ...p, grid: newGrid } : p);
        savePlansData({ ...plansData, plans: newPlans }, skipSupabase);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                // Ignore if typing in an input or textarea
                if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                    return;
                }
                e.preventDefault();
                if (historyIndexRef.current > 0) {
                    const newIndex = historyIndexRef.current - 1;
                    historyIndexRef.current = newIndex;
                    const previousState = historyRef.current[newIndex];
                    savePlansData(previousState, false, true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSubcontractorId]);

    const handleCreatePlan = () => {
        setNewPlanData({ name: `Plan ${plansData.plans.length + 1} `, type: 'week', startWeek: getIsoWeek(new Date()) });
        setShowPlanModal(true);
    };

    const confirmCreatePlan = () => {
        const newPlan: ProgressPlan = {
            id: `plan - ${Date.now()} `,
            name: newPlanData.name,
            grid: {
                ...defaultGrid,
                columns: Array.from({ length: 12 }, (_, i) => {
                    let w = newPlanData.startWeek + i;
                    if (w > 52) w -= 52;
                    return { id: `c_init_${i} `, label: `Uke ${w} ` };
                })
            }
        };
        savePlansData({ ...plansData, activePlanId: newPlan.id, plans: [...plansData.plans, newPlan] });
        setShowPlanModal(false);
    };

    const handleRenamePlan = () => {
        const planName = prompt("Nytt navn på plan:", activePlan.name);
        if (!planName || planName === activePlan.name) return;
        const newPlans = plansData.plans.map(p => p.id === activePlan.id ? { ...p, name: planName } : p);
        savePlansData({ ...plansData, plans: newPlans });
    };

    const handleDeletePlan = () => {
        if (plansData.plans.length <= 1) {
            alert("Du må ha minst én fremdriftsplan.");
            return;
        }
        if (confirm(`Er du sikker på at du vil slette planen "${activePlan.name}" ? `)) {
            const newPlans = plansData.plans.filter(p => p.id !== activePlan.id);
            savePlansData({ activePlanId: newPlans[0].id, plans: newPlans });
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setUploadPlanName(file.name.replace(/\.[^/.]+$/, ""));
            setShowUploadPlanModal(true);
        }
    };

    const confirmFileUpload = async () => {
        if (!selectedFile || !uploadPlanName) return;
        setUploadingPlan(true);
        try {
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            const { data, error: dbError } = await supabase
                .from('project_progress_plans')
                .insert([{ name: uploadPlanName, file_url: publicUrl }])
                .select();

            if (dbError) throw dbError;

            setProjectPlans(prev => [data[0], ...prev]);
            setShowUploadPlanModal(false);
            setSelectedFile(null);
            setUploadPlanName('');
        } catch (error) {
            console.error('Error uploading plan:', error);
            alert('Kunne ikke laste opp plan.');
        } finally {
            setUploadingPlan(false);
        }
    };

    const deleteProjectPlan = async (id: string, fileUrl: string) => {
        if (!confirm('Er du sikker på at du vil slette denne planen?')) return;
        try {
            const fileName = fileUrl.split('/').pop();
            if (fileName) {
                await supabase.storage.from('documents').remove([fileName]);
            }
            const { error } = await supabase.from('project_progress_plans').delete().eq('id', id);
            if (error) throw error;
            setProjectPlans(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error('Error deleting plan:', error);
            alert('Kunne ikke slette plan.');
        }
    };

    const handleCellPointerDown = (e: React.PointerEvent, rIdx: number, cIdx: number) => {
        if (e.button !== 0) return; // Only left click
        
        const visibleRows = gridData.rows.filter(r => showHidden || !r.hidden);
        const visibleCols = gridData.columns.filter(c => showHidden || !c.hidden);
        const rowId = visibleRows[rIdx].id;
        const colId = visibleCols[cIdx].id;
        const cellKey = `${rowId}_${colId} `;
        const cellVal = gridData.cells[cellKey];
        
        // Check if clicked inside an existing selection
        let isInsideSelection = false;
        if (selectionStart && selectionEnd) {
            const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
            const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
            const minC = Math.min(selectionStart.cIdx, selectionEnd.cIdx);
            const maxC = Math.max(selectionStart.cIdx, selectionEnd.cIdx);
            if (rIdx >= minR && rIdx <= maxR && cIdx >= minC && cIdx <= maxC) {
                isInsideSelection = true;
            }
        }

        if (isInsideSelection && cellVal) {
            // Start dragging the existing selection
            setIsDragging(true);
            setIsSelecting(false);
            cellDragRef.current = {
                startRIdx: rIdx,
                startCIdx: cIdx,
                originalSelectionStart: { ...selectionStart! },
                originalSelectionEnd: { ...selectionEnd! }
            };
        } else if (cellVal) {
            // Start dragging a single cell
            setIsDragging(true);
            setIsSelecting(false);
            setSelectionStart({ rIdx, cIdx });
            setSelectionEnd({ rIdx, cIdx });
            cellDragRef.current = {
                startRIdx: rIdx,
                startCIdx: cIdx,
                originalSelectionStart: { rIdx, cIdx },
                originalSelectionEnd: { rIdx, cIdx }
            };
        } else {
            // Start a new selection
            setIsSelecting(true);
            setIsDragging(false);
            setSelectionStart({ rIdx, cIdx });
            setSelectionEnd({ rIdx, cIdx });
            setSelectedCell(null);
            cellDragRef.current = null;
        }
    };

    const handleCellPointerMove = (_e: React.PointerEvent, rIdx: number, cIdx: number) => {
        if (isSelecting) {
            setSelectionEnd({ rIdx, cIdx });
        } else if (isDragging && cellDragRef.current) {
            const { startRIdx, startCIdx, originalSelectionStart, originalSelectionEnd } = cellDragRef.current;
            if (!originalSelectionStart || !originalSelectionEnd) return;

            const deltaR = rIdx - startRIdx;
            const deltaC = cIdx - startCIdx;

            const visibleRows = gridData.rows.filter(r => showHidden || !r.hidden);
            const visibleCols = gridData.columns.filter(c => showHidden || !c.hidden);

            const minR = Math.min(originalSelectionStart.rIdx, originalSelectionEnd.rIdx);
            const maxR = Math.max(originalSelectionStart.rIdx, originalSelectionEnd.rIdx);
            const minC = Math.min(originalSelectionStart.cIdx, originalSelectionEnd.cIdx);
            const maxC = Math.max(originalSelectionStart.cIdx, originalSelectionEnd.cIdx);

            const newMinR = minR + deltaR;
            const newMaxR = maxR + deltaR;
            const newMinC = minC + deltaC;
            const newMaxC = maxC + deltaC;

            // Check if new selection is within bounds
            if (newMinR >= 0 && newMaxR < visibleRows.length && newMinC >= 0 && newMaxC < visibleCols.length) {
                setSelectionStart({ rIdx: originalSelectionStart.rIdx + deltaR, cIdx: originalSelectionStart.cIdx + deltaC });
                setSelectionEnd({ rIdx: originalSelectionEnd.rIdx + deltaR, cIdx: originalSelectionEnd.cIdx + deltaC });
            }
        }
    };

    const handleCellPointerUp = async (e: React.PointerEvent) => {
        if (isDragging && cellDragRef.current) {
            const { originalSelectionStart, originalSelectionEnd } = cellDragRef.current;
            
            if (originalSelectionStart && originalSelectionEnd && selectionStart) {
                const deltaR = selectionStart.rIdx - originalSelectionStart.rIdx;
                const deltaC = selectionStart.cIdx - originalSelectionStart.cIdx;

                if (deltaR !== 0 || deltaC !== 0) {
                    const visibleRows = gridData.rows.filter(r => showHidden || !r.hidden);
                    const visibleCols = gridData.columns.filter(c => showHidden || !c.hidden);
                    const newCells = { ...gridData.cells };
                    const cellsToMove: { sourceKey: string, targetKey: string, data: any }[] = [];

                    const minR = Math.min(originalSelectionStart.rIdx, originalSelectionEnd.rIdx);
                    const maxR = Math.max(originalSelectionStart.rIdx, originalSelectionEnd.rIdx);
                    const minC = Math.min(originalSelectionStart.cIdx, originalSelectionEnd.cIdx);
                    const maxC = Math.max(originalSelectionStart.cIdx, originalSelectionEnd.cIdx);

                    for (let r = minR; r <= maxR; r++) {
                        for (let c = minC; c <= maxC; c++) {
                            const sourceRowId = visibleRows[r].id;
                            const sourceColId = visibleCols[c].id;
                            const sourceKey = `${sourceRowId}_${sourceColId} `;
                            const sourceData = newCells[sourceKey];

                            if (sourceData) {
                                const targetRIdx = r + deltaR;
                                const targetCIdx = c + deltaC;
                                if (targetRIdx >= 0 && targetRIdx < visibleRows.length && targetCIdx >= 0 && targetCIdx < visibleCols.length) {
                                    const targetRowId = visibleRows[targetRIdx].id;
                                    const targetColId = visibleCols[targetCIdx].id;
                                    const targetKey = `${targetRowId}_${targetColId} `;
                                    cellsToMove.push({ sourceKey, targetKey, data: sourceData });
                                }
                            }
                        }
                    }

                    // Remove all sources first to avoid overwriting within the selection
                    cellsToMove.forEach(({ sourceKey }) => {
                        delete newCells[sourceKey];
                    });

                    // Add to targets
                    cellsToMove.forEach(({ targetKey, data }) => {
                        newCells[targetKey] = data;
                    });

                    await saveGrid({ ...gridData, cells: newCells });
                }
            }
            setIsDragging(false);
            cellDragRef.current = null;
        } else if (isSelecting && selectionStart && selectionEnd) {
            const hadMovement = selectionStart.rIdx !== selectionEnd.rIdx || selectionStart.cIdx !== selectionEnd.cIdx;
            if (!hadMovement) {
                // Single click without drag - open edit modal
                const visibleRows = gridData.rows.filter(r => showHidden || !r.hidden);
                const visibleCols = gridData.columns.filter(c => showHidden || !c.hidden);
                const rowId = visibleRows[selectionStart.rIdx].id;
                const colId = visibleCols[selectionStart.cIdx].id;
                handleCellClick(rowId, colId);
                setSelectionStart(null);
                setSelectionEnd(null);
            }
            setIsSelecting(false);
        } else {
            setIsDragging(false);
            setIsSelecting(false);
            cellDragRef.current = null;
        }
        try {
            (e.target as Element).releasePointerCapture(e.pointerId);
        } catch (err) {}
    };

    const getSelectedCells = () => {
        if (!selectionStart || !selectionEnd) return [];
        const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
        const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
        const minC = Math.min(selectionStart.cIdx, selectionEnd.cIdx);
        const maxC = Math.max(selectionStart.cIdx, selectionEnd.cIdx);

        const selected = [];
        const visibleRows = gridData.rows.filter(r => showHidden || !r.hidden);
        const visibleCols = gridData.columns.filter(c => showHidden || !c.hidden);

        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (visibleRows[r] && visibleCols[c]) {
                    selected.push({ rowId: visibleRows[r].id, colId: visibleCols[c].id });
                }
            }
        }
        return selected;
    };

    const isCellSelected = (rIdx: number, cIdx: number) => {
        if (!selectionStart || !selectionEnd) return false;
        const minR = Math.min(selectionStart.rIdx, selectionEnd.rIdx);
        const maxR = Math.max(selectionStart.rIdx, selectionEnd.rIdx);
        const minC = Math.min(selectionStart.cIdx, selectionEnd.cIdx);
        const maxC = Math.max(selectionStart.cIdx, selectionEnd.cIdx);
        return rIdx >= minR && rIdx <= maxR && cIdx >= minC && cIdx <= maxC;
    };

    const handleBulkStatusChange = (status: 'not_started' | 'in_progress' | 'completed') => {
        const selected = getSelectedCells();
        if (selected.length === 0) return;

        const newCells = { ...gridData.cells };
        selected.forEach(({ rowId, colId }) => {
            const cellKey = `${rowId}_${colId} `;
            const existing = newCells[cellKey];
            if (typeof existing === 'string' || !existing) {
                newCells[cellKey] = { status };
            } else {
                newCells[cellKey] = { ...existing, status };
            }
        });
        saveGrid({ ...gridData, cells: newCells });
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const handleBulkDelete = () => {
        const selected = getSelectedCells();
        if (selected.length === 0) return;

        const newCells = { ...gridData.cells };
        selected.forEach(({ rowId, colId }) => {
            const cellKey = `${rowId}_${colId} `;
            delete newCells[cellKey];
        });
        saveGrid({ ...gridData, cells: newCells });
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    const handleCellClick = (rowId: string, colId: string, e?: React.MouseEvent) => {
        const cellKey = `${rowId}_${colId} `;
        const cellVal = gridData.cells[cellKey];

        if (!cellVal) {
            const newCells = { ...gridData.cells, [cellKey]: { status: 'not_started' } };
            saveGrid({ ...gridData, cells: newCells });
        } else {
            let formData: CellData;
            if (typeof cellVal === 'string') {
                formData = { status: 'not_started' };
            } else {
                formData = { ...cellVal };
            }
            setCellFormData(formData);
            setSelectedCell({ rowId, colId });
            if (e) {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setCellPopoverPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
            }
        }
    };

    const handleSaveCellData = () => {
        if (!selectedCell || !cellFormData) return;
        const cellKey = `${selectedCell.rowId}_${selectedCell.colId} `;
        const newCells = { ...gridData.cells, [cellKey]: cellFormData };
        saveGrid({ ...gridData, cells: newCells });
        setSelectedCell(null);
        setCellPopoverPos(null);
    };

    const handleDeleteCellData = () => {
        if (!selectedCell) return;
        const cellKey = `${selectedCell.rowId}_${selectedCell.colId} `;
        const newCells = { ...gridData.cells };
        delete newCells[cellKey];
        saveGrid({ ...gridData, cells: newCells });
        setSelectedCell(null);
        setCellPopoverPos(null);
    };

    const handleAddGridRow = () => {
        setShowAreaPickerModal(true);
    };

    const confirmAddGridRow = (areaStr: string) => {
        if (areaStr) {
            const newRow = { id: `r${Date.now()} `, label: areaStr };
            saveGrid({ ...gridData, rows: [...gridData.rows, newRow] });
        }
        setShowAreaPickerModal(false);
    };

    const handleAddGridCol = () => {
        let titleSuggest = "Uke 1";
        if (gridData.columns.length > 0) {
            const lastLabel = gridData.columns[gridData.columns.length - 1].label;
            const isCustomNonWrapping = /periode|måned|mnd|dag|uke\s*ikke/i.test(lastLabel);
            const numMatch = lastLabel.match(/(\d+)/);

            if (numMatch) {
                let num = parseInt(numMatch[1], 10);
                num += 1;
                if (!isCustomNonWrapping && num > 52) {
                    num = 1;
                }
                titleSuggest = lastLabel.replace(numMatch[1], num.toString());
            } else {
                titleSuggest = "Ny Kolonne";
            }
        }

        const title = prompt("Navn på Uke / Periode:", titleSuggest);
        if (title) {
            const newCol = { id: `c${Date.now()} `, label: title };
            saveGrid({ ...gridData, columns: [...gridData.columns, newCol] });
        }
    };

    const toggleHideRow = (id: string, hidden: boolean) => {
        const rows = gridData.rows.map(r => r.id === id ? { ...r, hidden } : r);
        saveGrid({ ...gridData, rows });
    };

    const deleteRow = (id: string) => {
        if (!confirm("Er du sikker på at du vil fjerne denne raden?")) return;
        saveGrid({ ...gridData, rows: gridData.rows.filter(r => r.id !== id) });
    };

    const toggleHideCol = (id: string, hidden: boolean) => {
        const cols = gridData.columns.map(c => c.id === id ? { ...c, hidden } : c);
        saveGrid({ ...gridData, columns: cols });
    };

    const deleteCol = (id: string) => {
        if (!confirm("Er du sikker på at du vil fjerne denne kolonnen?")) return;
        saveGrid({ ...gridData, columns: gridData.columns.filter(c => c.id !== id) });
    };





    const handleAddPhoto = async () => {
        // e.preventDefault(); // Removed as per instruction
        setLoading(true);
        const selectedArea = areas.find(a => a.id === newPhoto.area_id);
        const areaName = selectedArea ? `${selectedArea.building}${selectedArea.floor ? ` - ${selectedArea.floor}` : ''}${selectedArea.zone ? ` - ${selectedArea.zone}` : ''} ` : newPhoto.area;

        const payload = {
            subcontractor_id: selectedSubcontractorId,
            area: areaName,
            area_id: newPhoto.area_id || null, // Priority to area_id
            photo_url: newPhoto.photo_url || "https://images.unsplash.com/photo-1541888081643-fc69a212354c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80", // Fallback image for demo
            notes: newPhoto.notes,
            date: newPhoto.date
        };

        let result;
        if (newPhoto.id) {
            result = await supabase.from('photos').update(payload).eq('id', newPhoto.id).select();
        } else {
            result = await supabase.from('photos').insert([payload]).select();
        }

        const { data, error } = result;

        if (!error && data) {
            if (newPhoto.id) {
                setPhotos(photos.map(p => p.id === newPhoto.id ? data[0] : p).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } else {
                setPhotos([data[0], ...photos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
            setShowModal(false);
            setNewPhoto({ area: '', area_id: '', photo_url: '', notes: '', date: new Date().toISOString().split('T')[0] });
        } else {
            alert('Kunne ikke lagre fremdriftsbilde.');
        }
        setLoading(false);
    };

    const handleEditClick = (photo: any) => {
        setNewPhoto({
            id: photo.id,
            area: photo.area || '',
            area_id: photo.area_id || '',
            photo_url: photo.photo_url || '',
            notes: photo.notes || '',
            date: photo.date
        });
        setShowModal(true);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <Camera className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å se fremdriftsbilder.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fremdriftskontroll</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Dokumenter fremdrift på byggeplass med bilder</p>
                </div>
                <button
                    onClick={() => {
                        setNewPhoto({ area: '', area_id: '', photo_url: '', notes: '', date: new Date().toISOString().split('T')[0] });
                        setShowModal(true);
                    }}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Last opp bilde
                </button>
            </div>

            {/* Progress Plan Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-500/10 transition-colors"></div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10 mb-8 pb-6 border-b border-slate-200/60">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center">
                            <CalendarIcon className="w-5 h-5 mr-3 text-primary-500" />
                            Underentreprenørens fremdriftsplan - {subcontractors.find(s => s.id === selectedSubcontractorId)?.company_name || 'Ukjent'}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1.5 font-medium">Fremdriftsmatrise basert på etasjer og uker/perioder</p>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center shrink-0"
                        >
                            <UploadCloud className="w-4 h-4 mr-2" />
                            Last opp prosjektplan (PDF)
                        </button>
                        <button
                            onClick={() => setShowViewPlansModal(true)}
                            className="bg-primary-50 text-primary-700 px-4 py-2.5 rounded-xl font-bold text-sm border border-primary-100 hover:bg-primary-100 transition-colors flex items-center shrink-0"
                        >
                            Se prosjektets fremdriftsplan
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto w-full">
                    {loading ? (
                        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                    ) : (
                        <div className="p-4 sm:p-6 bg-slate-50/30">
                            {/* Plan Selector & Grid Controls */}
                            <div className="flex flex-col gap-4 mb-6">
                                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-4">
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <select
                                            value={plansData.activePlanId}
                                            onChange={(e) => savePlansData({ ...plansData, activePlanId: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 shadow-sm"
                                        >
                                            {plansData.plans.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <button onClick={handleCreatePlan} className="text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-colors" title="Ny plan"><Plus className="w-5 h-5" /></button>
                                        <button onClick={handleRenamePlan} className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 p-2 rounded-lg transition-colors" title="Bruk nytt navn på denne planen"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={handleDeletePlan} className="text-slate-400 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition-colors" title="Slett denne planen"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-2 flex-wrap">
                                            <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 bg-red-50 text-red-600 border border-red-200">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                                Ikke påbegynt
                                            </div>
                                            <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 bg-yellow-50 text-yellow-600 border border-yellow-200">
                                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                                                Påbegynt
                                            </div>
                                            <div className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 bg-green-50 text-green-600 border border-green-200">
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                                Ferdig
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Grid Builder */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm w-max max-w-full overflow-x-auto">
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="p-3 border-b border-r border-slate-200 min-w-[250px] sticky left-0 z-10 bg-slate-50 text-xs font-bold text-slate-500 uppercase flex flex-col justify-end min-h-[48px]">
                                                <div className="flex justify-between items-center w-full h-full">
                                                    <span>Område / Etasje</span>
                                                    <button onClick={() => setShowHidden(!showHidden)} className={`p-1 rounded hover:bg-slate-200 transition-colors ${showHidden ? 'text-primary-600' : 'text-slate-400'}`} title="Vis/skjul elementer">
                                                        {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </th>
                                            {gridData.columns.filter(c => showHidden || !c.hidden).map((col, idx, arr) => (
                                                <th key={col.id} className={`p-2 border-b border-slate-200 min-w-[80px] text-center text-xs font-bold text-slate-700 relative group ${col.hidden ? 'bg-slate-100/50 opacity-50' : ''}`}>
                                                    <div className="flex flex-col items-center justify-center w-full h-full relative pb-5">
                                                        <span>{col.label}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-0 left-1/2 -translate-x-1/2 z-30">
                                                            <button onClick={() => toggleHideCol(col.id, !col.hidden)} className="text-slate-500 hover:text-primary-600 p-1 rounded hover:bg-slate-200" title={col.hidden ? 'Vis' : 'Skjul'}>
                                                                {col.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button onClick={() => deleteCol(col.id)} className="text-slate-500 hover:text-red-600 p-1 rounded hover:bg-red-100" title="Fjern">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {idx === arr.length - 1 && (
                                                        <div
                                                            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary-500 cursor-ew-resize translate-y-[40%] translate-x-[40%] rounded-sm z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto"
                                                            onPointerDown={(e) => startDrag(e, 'col')}
                                                        >
                                                            <div className="w-1 h-1 bg-white rounded-full"></div>
                                                        </div>
                                                    )}
                                                </th>
                                            ))}
                                            <th className="p-3 border-b border-slate-200 min-w-[160px] text-center align-middle">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={handleAddGridCol}
                                                        className="px-4 py-2 bg-primary-50 border border-primary-200 text-primary-700 text-xs font-extrabold rounded-xl hover:bg-primary-100 flex items-center justify-center mx-auto whitespace-nowrap w-full transition-all"
                                                    >
                                                        <Plus className="w-4 h-4 mr-1.5" />
                                                        Legg til Uke
                                                    </button>
                                                    <div
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-primary-300 cursor-ew-resize bg-primary-50/50 hover:bg-primary-100/80 hover:border-primary-400 transition-all w-full group"
                                                        onPointerDown={(e) => startDrag(e, 'col')}
                                                        title="Hold inne og dra til høyre for å legge til flere uker automatisk"
                                                    >
                                                        <div className="flex gap-0.5">
                                                            <div className="w-1 h-4 bg-primary-400 rounded-full group-hover:bg-primary-500 transition-colors"></div>
                                                            <div className="w-1 h-4 bg-primary-300 rounded-full group-hover:bg-primary-400 transition-colors"></div>
                                                        </div>
                                                        <span className="text-xs text-primary-600 font-bold leading-tight">Dra for å utvide</span>
                                                        <svg className="w-4 h-4 text-primary-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gridData.rows.filter(r => showHidden || !r.hidden).map((row, idx, arr) => (
                                            <tr key={row.id} className={row.hidden ? 'opacity-50 bg-slate-50/50' : ''}>
                                                <td className="p-3 border-b border-r border-slate-200 text-sm font-bold text-slate-800 sticky left-0 z-10 bg-white relative group">
                                                    <div className="flex justify-between items-center pr-6 h-full w-full">
                                                        <span>{row.label}</span>
                                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded p-0.5 shadow-sm border border-slate-100 absolute right-1 top-1/2 -translate-y-1/2 z-30">
                                                            <button onClick={() => toggleHideRow(row.id, !row.hidden)} className="text-slate-500 hover:text-primary-600 p-1 rounded hover:bg-slate-50" title={row.hidden ? 'Vis' : 'Skjul'}>
                                                                {row.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button onClick={() => deleteRow(row.id)} className="text-slate-500 hover:text-red-600 p-1 rounded hover:bg-red-50" title="Fjern">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {idx === arr.length - 1 && (
                                                        <div
                                                            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary-500 cursor-ns-resize translate-y-[40%] translate-x-[40%] rounded-sm z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto"
                                                            onPointerDown={(e) => startDrag(e, 'row')}
                                                        >
                                                            <div className="w-1 h-1 bg-white rounded-full"></div>
                                                        </div>
                                                    )}
                                                </td>
                                                {gridData.columns.filter(c => showHidden || !c.hidden).map((col, colIdx) => {
                                                    const cellKey = `${row.id}_${col.id} `;
                                                    const cellVal = gridData.cells[cellKey];
                                                    let cellColor = '';
                                                    if (typeof cellVal === 'string') {
                                                        cellColor = cellVal;
                                                    } else if (cellVal) {
                                                        if (cellVal.status === 'not_started') cellColor = '#ef4444';
                                                        else if (cellVal.status === 'in_progress') cellColor = '#eab308';
                                                        else if (cellVal.status === 'completed') cellColor = '#22c55e';
                                                    }
                                                    return (
                                                        <td
                                                            key={col.id}
                                                            onPointerDown={(e) => handleCellPointerDown(e, idx, colIdx)}
                                                            onPointerMove={(e) => handleCellPointerMove(e, idx, colIdx)}
                                                            onPointerUp={handleCellPointerUp}
                                                            className={`border-b border-slate-100 cursor-pointer transition-colors m-1 select-none relative group/cell ${isCellSelected(idx, colIdx) ? 'bg-primary-50 ring-1 ring-inset ring-primary-300' : 'hover:bg-slate-50'}`}
                                                        >
                                                            <div className="w-full h-6 p-0.5 flex items-center justify-center relative pointer-events-none">
                                                                {cellColor && (
                                                                    <div
                                                                        className="w-full h-full rounded shadow-sm opacity-90 flex flex-col items-center justify-center p-1"
                                                                        style={{ backgroundColor: cellColor }}
                                                                    >
                                                                        {cellVal && typeof cellVal !== 'string' && cellVal.comment && (
                                                                            <div className="w-1.5 h-1.5 bg-white/50 rounded-full absolute right-1.5 top-1.5 shadow-sm"></div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {cellColor && (
                                                                <button 
                                                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 bg-white rounded-full p-1 shadow-md z-10 pointer-events-auto hover:bg-slate-100"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCellClick(row.id, col.id, e);
                                                                    }}
                                                                >
                                                                    <Edit2 className="w-3 h-3 text-slate-600" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="border-b border-slate-100 m-1"></td>
                                            </tr>
                                        ))}
                                        {/* Add Row Button at the bottom */}
                                        <tr>
                                            <td className="p-3 border-b border-r border-slate-200 sticky left-0 z-10 bg-white">
                                                <div className="flex flex-col gap-1.5">
                                                    <button
                                                        onClick={handleAddGridRow}
                                                        className="px-4 py-2 w-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-extrabold rounded-xl hover:bg-primary-100 flex items-center justify-center transition-all"
                                                    >
                                                        <Plus className="w-4 h-4 mr-1.5" />
                                                        Legg til Område
                                                    </button>
                                                    <div
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-primary-300 cursor-ns-resize bg-primary-50/50 hover:bg-primary-100/80 hover:border-primary-400 transition-all w-full group"
                                                        onPointerDown={(e) => startDrag(e, 'row')}
                                                        title="Hold inne og dra nedover for å legge til flere rader automatisk"
                                                    >
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="h-1 w-4 bg-primary-400 rounded-full group-hover:bg-primary-500 transition-colors"></div>
                                                            <div className="h-1 w-4 bg-primary-300 rounded-full group-hover:bg-primary-400 transition-colors"></div>
                                                        </div>
                                                        <span className="text-xs text-primary-600 font-bold leading-tight">Dra for å utvide</span>
                                                        <svg className="w-4 h-4 text-primary-500 ml-auto rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                                    </div>
                                                </div>
                                            </td>
                                            <td colSpan={gridData.columns.filter(c => showHidden || !c.hidden).length + 1} className="border-b border-slate-100 bg-slate-50/10"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Bulk Actions Floating Bar */}
                            {selectionStart && selectionEnd && (selectionStart.rIdx !== selectionEnd.rIdx || selectionStart.cIdx !== selectionEnd.cIdx) && (
                                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom border border-slate-700">
                                    <span className="font-bold text-sm text-slate-300 border-r border-slate-700 pr-4">
                                        {getSelectedCells().length} celler merket
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleBulkStatusChange('not_started')} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div> Ikke påbegynt
                                        </button>
                                        <button onClick={() => handleBulkStatusChange('in_progress')} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div> Påbegynt
                                        </button>
                                        <button onClick={() => handleBulkStatusChange('completed')} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors">
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div> Ferdig
                                        </button>
                                    </div>
                                    <div className="h-6 w-[1px] bg-slate-700 mx-2"></div>
                                    <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-colors" title="Tøm valgte celler">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setSelectionStart(null); setSelectionEnd(null); }} className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors ml-2" title="Lukk">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-transparent mt-8">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center">
                    <Camera className="w-5 h-5 mr-2 text-primary-500" />
                    Bilderapport
                </h2>
            </div>


            {
                loading ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : photos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                        <div className="bg-slate-50 p-6 rounded-full mb-6">
                            <Camera className="w-12 h-12 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">Ingen bilder loggført</h3>
                        <p className="text-slate-500 text-center mt-2 font-medium">Klikk på last opp for å legge til fremdriftsbilder.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {photos.map((photo) => (
                            <div key={photo.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300 transition-all group">
                                <div className="h-48 bg-slate-100 relative overflow-hidden">
                                    <img src={photo.photo_url || "https://images.unsplash.com/photo-1541888081643-fc69a212354c?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} alt="Progress" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                        <ImageIcon className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center text-sm font-bold text-slate-700 mb-2">
                                        <MapPin className="w-4 h-4 mr-1.5 text-primary-500" />
                                        {photo.area_id
                                            ? (() => {
                                                const area = areas.find(a => a.id === photo.area_id);
                                                return area ? `${area.building}${area.floor ? ` - ${area.floor}` : ''}${area.zone ? ` - ${area.zone}` : ''} ` : photo.area;
                                            })()
                                            : photo.area}
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium line-clamp-2">{photo.notes}</p>
                                    <div className="mt-4 flex justify-between items-center text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                        <span>Loggført: {new Date(photo.date).toLocaleDateString('no-NO')}</span>
                                        <button onClick={() => handleEditClick(photo)} className="flex items-center text-primary-600 hover:text-primary-700 transition-colors p-1">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {/* Add Photo Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <h3 className="text-lg font-extrabold text-slate-800">{newPhoto.id ? 'Rediger Fremdriftsrapport' : 'Ny Fremdriftsrapport'}</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleAddPhoto} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Dato</label>
                                    <input
                                        type="date"
                                        required
                                        value={newPhoto.date}
                                        onChange={(e) => setNewPhoto({ ...newPhoto, date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Område / Plassering</label>
                                    {areas.length > 0 ? (
                                        <select
                                            required
                                            value={newPhoto.area_id}
                                            onChange={(e) => setNewPhoto({ ...newPhoto, area_id: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                        >
                                            <option value="" disabled>Velg forhåndsdefinert område</option>
                                            {areas.map(area => (
                                                <option key={area.id} value={area.id}>
                                                    {area.building}{area.floor ? ` - ${area.floor} ` : ''}{area.zone ? ` - ${area.zone} ` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            required
                                            value={newPhoto.area}
                                            onChange={(e) => setNewPhoto({ ...newPhoto, area: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                            placeholder="F.eks. Plan 2, Sone Nord"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Bilde URL (Bruk lenke for MVP)</label>
                                    <input
                                        type="url"
                                        value={newPhoto.photo_url}
                                        onChange={(e) => setNewPhoto({ ...newPhoto, photo_url: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        placeholder="https://"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Notater</label>
                                    <textarea
                                        rows={3}
                                        required
                                        value={newPhoto.notes}
                                        onChange={(e) => setNewPhoto({ ...newPhoto, notes: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        placeholder="Beskriv fremdriften..."
                                    />
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                        Avbryt
                                    </button>
                                    <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                        {loading ? 'Lagrer...' : 'Lagre Rapport'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Area Picker Modal for Matrix */}
            {/* Create Plan Modal */}
            {
                showPlanModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <h3 className="text-lg font-extrabold text-slate-800">Ny Fremdriftsplan</h3>
                                <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={confirmCreatePlan} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Navn på plan</label>
                                    <input
                                        type="text"
                                        required
                                        value={newPlanData.name}
                                        onChange={(e) => setNewPlanData({ ...newPlanData, name: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Periodetype</label>
                                    <select
                                        value={newPlanData.type}
                                        onChange={(e) => setNewPlanData({ ...newPlanData, type: e.target.value as any })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                                    >
                                        <option value="week">Uker (Standard)</option>
                                        <option value="custom">Egendefinert</option>
                                    </select>
                                </div>
                                {newPlanData.type === 'week' && (
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">Start uke</label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            max={52}
                                            value={newPlanData.startWeek}
                                            onChange={(e) => setNewPlanData({ ...newPlanData, startWeek: parseInt(e.target.value, 10) || 1 })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                                        />
                                    </div>
                                )}
                                <div className="pt-2 flex gap-3">
                                    <button type="button" onClick={() => setShowPlanModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                        Avbryt
                                    </button>
                                    <button type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors">
                                        Opprett Plan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                showAreaPickerModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                                <h3 className="text-lg font-extrabold text-slate-800">Velg Område / Bygg</h3>
                                <button onClick={() => setShowAreaPickerModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1">
                                {areas.length === 0 ? (
                                    <p className="text-sm text-slate-500 text-center">Ingen områder definert for denne underentreprenøren.</p>
                                ) : (
                                    Array.from(new Set(areas.map(a => a.building))).map(building => (
                                        <div key={building} className="mb-4">
                                            <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-2">{building}</h4>
                                            <div className="space-y-2">
                                                {areas.filter(a => a.building === building).map(area => {
                                                    const label = `${building} - ${area.floor}${area.zone ? ` - ${area.zone}` : ''} `;
                                                    return (
                                                        <button
                                                            key={area.id}
                                                            onClick={() => confirmAddGridRow(label)}
                                                            className="w-full text-left px-3 py-2 text-sm font-medium text-slate-600 hover:bg-primary-50 hover:text-primary-700 rounded-lg transition-colors border border-transparent hover:border-primary-100"
                                                        >
                                                            {area.floor}{area.zone ? ` - ${area.zone} ` : ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                                <button onClick={() => setShowAreaPickerModal(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-sm">
                                    Lukk
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Cell Details Popover */}
            {
                selectedCell && cellFormData && cellPopoverPos && (
                    <div 
                        className="fixed z-[100] bg-white rounded-2xl shadow-2xl border border-slate-200 w-80 overflow-hidden"
                        style={{ 
                            top: `${Math.min(cellPopoverPos.top, window.innerHeight - 400)}px`, 
                            left: `${Math.min(cellPopoverPos.left, window.innerWidth - 320)}px` 
                        }}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-sm font-extrabold text-slate-800">Rediger celle</h3>
                            <button onClick={() => { setSelectedCell(null); setCellPopoverPos(null); }} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveCellData(); }} className="p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                                <select
                                    value={cellFormData.status}
                                    onChange={(e) => setCellFormData({ ...cellFormData, status: e.target.value as any })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                >
                                    <option value="not_started">Ikke påbegynt (Rød)</option>
                                    <option value="in_progress">Påbegynt (Gul)</option>
                                    <option value="completed">Ferdig (Grønn)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Faktisk oppstart</label>
                                    <input
                                        type="date"
                                        value={cellFormData.actualStart || ''}
                                        onChange={(e) => setCellFormData({ ...cellFormData, actualStart: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Faktisk slutt</label>
                                    <input
                                        type="date"
                                        value={cellFormData.actualEnd || ''}
                                        onChange={(e) => setCellFormData({ ...cellFormData, actualEnd: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Kommentar / Avhengigheter</label>
                                <textarea
                                    rows={2}
                                    value={cellFormData.comment || ''}
                                    onChange={(e) => setCellFormData({ ...cellFormData, comment: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 placeholder:text-slate-400"
                                    placeholder="F.eks. Rørlegger må bli ferdig..."
                                />
                            </div>
                            <div className="pt-3 flex items-center justify-between border-t border-slate-100 mt-2">
                                <button type="button" onClick={handleDeleteCellData} className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg font-bold text-xs transition-colors flex items-center">
                                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Fjern
                                </button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setSelectedCell(null); setCellPopoverPos(null); }} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition-colors">
                                        Avbryt
                                    </button>
                                    <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white font-bold text-xs rounded-lg hover:bg-primary-700 transition-colors">
                                        Lagre
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )
            }
            {/* Upload Plan Name Modal */}
            {showUploadPlanModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Navngi Plandokument</h3>
                            <button onClick={() => setShowUploadPlanModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Dokumentnavn</label>
                                <input
                                    type="text"
                                    value={uploadPlanName}
                                    onChange={(e) => setUploadPlanName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-medium"
                                    placeholder="F.eks. Hovedplan 2024"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={confirmFileUpload}
                                disabled={uploadingPlan || !uploadPlanName}
                                className="w-full bg-primary-600 text-white py-3 rounded-xl font-extrabold text-sm shadow-lg shadow-primary-500/25 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {uploadingPlan ? 'Laster opp...' : 'Bekreft opplasting'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Plans List Modal */}
            {showViewPlansModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-primary-500" />
                                <h3 className="text-lg font-extrabold text-slate-800">Prosjektets Fremdriftsplaner</h3>
                            </div>
                            <button onClick={() => setShowViewPlansModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {projectPlans.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-slate-500 font-medium">Ingen PDF-planer er lastet opp ennå.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {projectPlans.map(plan => (
                                        <div key={plan.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50/10 transition-all group">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                                                    <UploadCloud className="w-5 h-5 text-primary-500" />
                                                </div>
                                                <span className="font-bold text-slate-700">{plan.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setPreviewPlan(plan)}
                                                    className="px-3 py-1.5 bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold rounded-lg hover:bg-primary-100 transition-all"
                                                >
                                                    Forhåndsvis
                                                </button>
                                                <a
                                                    href={plan.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1.5 bg-white border border-slate-200 text-primary-600 text-xs font-bold rounded-lg hover:bg-primary-50 hover:border-primary-200 transition-all"
                                                >
                                                    Åpne
                                                </a>
                                                <button
                                                    onClick={() => deleteProjectPlan(plan.id, plan.file_url)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Preview Modal */}
            {previewPlan && (
                <div className="fixed inset-0 z-[70] flex flex-col bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-center gap-3">
                            <CalendarIcon className="w-5 h-5 text-primary-500" />
                            <h3 className="text-lg font-extrabold text-slate-800">{previewPlan.name}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <a
                                href={previewPlan.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-primary-50 border border-primary-100 text-primary-700 text-sm font-bold rounded-xl hover:bg-primary-100 transition-all flex items-center gap-2"
                            >
                                <UploadCloud className="w-4 h-4" />
                                Åpne i ny fane
                            </a>
                            <button
                                onClick={() => setPreviewPlan(null)}
                                className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <iframe
                            src={previewPlan.file_url}
                            className="w-full h-full"
                            title={previewPlan.name}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
