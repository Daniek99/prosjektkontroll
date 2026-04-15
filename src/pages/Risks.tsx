import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Plus, ShieldAlert, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Risks() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [risks, setRisks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newRisk, setNewRisk] = useState({ description: '', probability: 'Medium', impact: 'Medium', status: 'open' });

    useEffect(() => {
        if (!selectedSubcontractorId) return;

        async function loadRisks() {
            const { data } = await supabase
                .from('risks')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('impact', { ascending: false })
                .order('probability', { ascending: false });

            if (data) setRisks(data);
            setLoading(false);
        }
        loadRisks();
    }, [selectedSubcontractorId]);

    const handleAddRisk = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.from('risks').insert([{
            subcontractor_id: selectedSubcontractorId,
            description: newRisk.description,
            probability: newRisk.probability,
            impact: newRisk.impact,
            status: newRisk.status
        }]).select();

        if (!error && data) {
            setRisks([data[0], ...risks]);
            setShowModal(false);
            setNewRisk({ description: '', probability: 'Medium', impact: 'Medium', status: 'open' });
        } else {
            alert('Kunne ikke lagre risiko.');
        }
        setLoading(false);
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

    // Helper for matrix styling
    const getRiskColor = (prob: string, impact: string) => {
        if (impact === 'High' && prob === 'High') return 'bg-red-500 text-white border-red-600';
        if (impact === 'High' || prob === 'High') return 'bg-orange-500 text-white border-orange-600';
        if (impact === 'Medium' || prob === 'Medium') return 'bg-amber-400 text-amber-900 border-amber-500';
        return 'bg-green-500 text-white border-green-600';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Risikostyring</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Identifiser, evaluer og håndter prosjektrisiko</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Registrer Risiko
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Matrix Visualization */}
                <div className="xl:col-span-1 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col items-center">
                    <h3 className="font-extrabold text-slate-800 mb-8 w-full text-center text-lg">Risikomatrise</h3>

                    <div className="relative w-full max-w-[280px] aspect-square">
                        <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                            Konsekvens
                        </div>
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                            Sannsynlighet
                        </div>

                        <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-2.5">
                            <div className="bg-orange-500 rounded-2xl shadow-inner border border-orange-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Med/Høy</span></div>
                            <div className="bg-red-500 rounded-2xl shadow-inner border border-red-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Høy</span></div>
                            <div className="bg-red-600 rounded-2xl shadow-inner border border-red-700/50 flex items-center justify-center p-2"><span className="text-white font-extrabold text-xs">Ekstrem</span></div>

                            <div className="bg-amber-400 rounded-2xl shadow-inner border border-amber-500/50 flex items-center justify-center p-2"><span className="text-amber-900/80 font-bold text-xs">Lav/Med</span></div>
                            <div className="bg-orange-500 rounded-2xl shadow-inner border border-orange-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Med</span></div>
                            <div className="bg-red-500 rounded-2xl shadow-inner border border-red-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Høy</span></div>

                            <div className="bg-green-500 rounded-2xl shadow-inner border border-green-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Lav</span></div>
                            <div className="bg-amber-400 rounded-2xl shadow-inner border border-amber-500/50 flex items-center justify-center p-2"><span className="text-amber-900/80 font-bold text-xs">Lav/Med</span></div>
                            <div className="bg-orange-500 rounded-2xl shadow-inner border border-orange-600/50 flex items-center justify-center p-2"><span className="text-white/90 font-bold text-xs">Med/Høy</span></div>
                        </div>
                    </div>
                </div>

                {/* Risk Log */}
                <div className="xl:col-span-2 bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[550px]">
                    <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center rounded-t-3xl">
                        <h3 className="font-extrabold text-slate-800 flex items-center text-lg">
                            <AlertTriangle className="w-5 h-5 mr-3 text-red-500" />
                            Gjeldende Risikoregister
                        </h3>
                    </div>
                    <div className="flex-1 overflow-auto p-4 sm:p-6">
                        {loading ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                        ) : risks.length === 0 ? (
                            <div className="text-center p-12 text-slate-500 font-medium">Ingen risikoer registrert.</div>
                        ) : (
                            <div className="space-y-4">
                                {risks.map(risk => (
                                    <div key={risk.id} className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all shadow-sm flex flex-col sm:flex-row gap-5 sm:items-center justify-between group">
                                        <div className="flex-1">
                                            <h4 className="font-extrabold text-slate-900 mb-1.5 text-lg group-hover:text-primary-700 transition-colors">{risk.description}</h4>
                                            <div className="text-xs font-bold text-slate-400 bg-slate-50 inline-block px-2 py-1 rounded-md">
                                                Lagt til {new Date(risk.created_at || new Date()).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                            <div className="flex flex-col items-center min-w-[60px]">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Sannsynlighet</span>
                                                <span className="px-3 py-1 bg-white text-slate-700 font-bold text-sm rounded-lg border border-slate-200 shadow-sm w-full text-center">{risk.probability}</span>
                                            </div>
                                            <div className="flex flex-col items-center min-w-[60px]">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Konsekvens</span>
                                                <span className="px-3 py-1 bg-white text-slate-700 font-bold text-sm rounded-lg border border-slate-200 shadow-sm w-full text-center">{risk.impact}</span>
                                            </div>
                                            <div className="flex flex-col items-center ml-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Status</span>
                                                <span className={cn(
                                                    "w-12 h-9 rounded-xl border flex items-center justify-center shadow-md",
                                                    getRiskColor(risk.probability, risk.impact)
                                                )}>
                                                    <AlertTriangle className="w-5 h-5" />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Risk Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Ny Risikoregistrering</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddRisk} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Beskrivelse</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={newRisk.description}
                                    onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="Beskriv risikoen..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Sannsynlighet</label>
                                    <select
                                        value={newRisk.probability}
                                        onChange={(e) => setNewRisk({ ...newRisk, probability: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    >
                                        <option value="Low">Lav</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">Høy</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Konsekvens</label>
                                    <select
                                        value={newRisk.impact}
                                        onChange={(e) => setNewRisk({ ...newRisk, impact: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                    >
                                        <option value="Low">Lav</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">Høy</option>
                                    </select>
                                </div>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : 'Lagre Risiko'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
