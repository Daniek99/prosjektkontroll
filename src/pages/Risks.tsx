import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, ShieldAlert, Save, CheckCircle2, Clock } from 'lucide-react';
import { usePageSubcontractor } from '../hooks/usePageSubcontractor';
import PageSubcontractorSelector from '../components/PageSubcontractorSelector';

interface RiskActivity {
    id: string;
    name: string;
    description: string | null;
    subcontractor_id: string | null;
    risk_assessment: boolean;
    risk_dangers: string | null;
    risk_solutions: string | null;
    risk_initiation_time: string | null;
    subcontractors?: { company_name: string } | null;
}

type RiskForm = {
    dangers: string;
    solutions: string;
    initiationTime: string;
};

export default function Risks() {
    const { selectedSubcontractorId, setSelectedSubcontractorId } = usePageSubcontractor();
    const [activities, setActivities] = useState<RiskActivity[]>([]);
    const [forms, setForms] = useState<Record<string, RiskForm>>({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedSubcontractorId) {
            setActivities([]);
            setLoading(false);
            return;
        }

        async function loadActivities() {
            setLoading(true);
            const { data } = await supabase
                .from('work_activities')
                .select('id, name, description, subcontractor_id, risk_assessment, risk_dangers, risk_solutions, risk_initiation_time, subcontractors(company_name)')
                .eq('subcontractor_id', selectedSubcontractorId)
                .eq('risk_assessment', true)
                .order('created_at', { ascending: false });

            const rows = (data ?? []) as unknown as RiskActivity[];
            setActivities(rows);

            const nextForms: Record<string, RiskForm> = {};
            rows.forEach((activity) => {
                nextForms[activity.id] = {
                    dangers: activity.risk_dangers ?? '',
                    solutions: activity.risk_solutions ?? '',
                    initiationTime: activity.risk_initiation_time ?? '',
                };
            });
            setForms(nextForms);
            setLoading(false);
        }

        loadActivities();
    }, [selectedSubcontractorId]);

    const updateForm = (id: string, field: keyof RiskForm, value: string) => {
        setForms((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    };

    const handleSave = async (activity: RiskActivity) => {
        const form = forms[activity.id];
        if (!form) return;
        setSavingId(activity.id);
        setSavedId(null);
        const { error } = await supabase
            .from('work_activities')
            .update({
                risk_dangers: form.dangers.trim() || null,
                risk_solutions: form.solutions.trim() || null,
                risk_initiation_time: form.initiationTime.trim() || null,
            })
            .eq('id', activity.id);

        setSavingId(null);
        if (error) {
            alert(`Kunne ikke lagre risikovurdering: ${error.message}`);
            return;
        }
        setActivities((prev) => prev.map((a) => a.id === activity.id
            ? {
                ...a,
                risk_dangers: form.dangers.trim() || null,
                risk_solutions: form.solutions.trim() || null,
                risk_initiation_time: form.initiationTime.trim() || null,
            }
            : a));
        setSavedId(activity.id);
        setTimeout(() => setSavedId((current) => (current === activity.id ? null : current)), 2500);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <ShieldAlert className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å administrere risiko.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Risikostyring</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Risikovurdering av aktiviteter — farer, tiltak og tid for oppstart
                    </p>
                </div>
                <PageSubcontractorSelector value={selectedSubcontractorId} onChange={setSelectedSubcontractorId} />
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
                    <div className="bg-slate-50 p-5 rounded-full mb-4">
                        <AlertTriangle className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-700">Ingen aktiviteter med risikovurdering</h3>
                    <p className="text-slate-500 text-center mt-2 font-medium max-w-md">
                        Kryss av for «Risikovurdering» når du oppretter en aktivitet i Bemanning eller Aktivitetsregisteret.
                        Aktiviteten vises da her, hvor du kan fylle inn farer, tiltak og tid for oppstart.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {activities.map((activity) => {
                        const form = forms[activity.id] ?? { dangers: '', solutions: '', initiationTime: '' };
                        const isSaving = savingId === activity.id;
                        const isSaved = savedId === activity.id;

                        return (
                            <div key={activity.id} className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-5 flex flex-col">
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-extrabold text-slate-900 truncate">{activity.name}</h3>
                                        {activity.description && (
                                            <p className="text-sm text-slate-500 font-medium mt-0.5">{activity.description}</p>
                                        )}
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            {activity.subcontractors?.company_name || 'Ukjent underentreprenør'}
                                        </p>
                                    </div>
                                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold uppercase tracking-widest">
                                        <AlertTriangle className="w-3 h-3" /> Risiko
                                    </span>
                                </div>

                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Farer</label>
                                        <textarea
                                            rows={3}
                                            value={form.dangers}
                                            onChange={(e) => updateForm(activity.id, 'dangers', e.target.value)}
                                            placeholder="Beskriv relevante farer ved aktiviteten..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Tiltak / løsninger</label>
                                        <textarea
                                            rows={3}
                                            value={form.solutions}
                                            onChange={(e) => updateForm(activity.id, 'solutions', e.target.value)}
                                            placeholder="Beskriv tiltak og løsninger..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" /> Tid for oppstart
                                        </label>
                                        <input
                                            type="text"
                                            value={form.initiationTime}
                                            onChange={(e) => updateForm(activity.id, 'initiationTime', e.target.value)}
                                            placeholder="F.eks. 2026-11-01 08:00 eller «Ved oppstart»"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                    {isSaved && (
                                        <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> Lagret
                                        </span>
                                    )}
                                    <button
                                        onClick={() => handleSave(activity)}
                                        disabled={isSaving}
                                        className="px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        <Save className="w-4 h-4" />
                                        {isSaving ? 'Lagrer...' : 'Lagre'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
