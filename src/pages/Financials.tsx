import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';
import { supabase } from '../lib/supabase';
import { Calculator, Plus, DollarSign, CheckCircle2, Clock, XCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Financials() {
    const { selectedSubcontractorId } = useSubcontractor();
    const [cos, setCos] = useState<any[]>([]);
    const [contract, setContract] = useState<any>({ original: 0, current: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newCO, setNewCO] = useState({ title: '', amount: 0, status: 'open' });

    useEffect(() => {
        if (!selectedSubcontractorId) return;

        async function loadFinancials() {
            const { data: sub } = await supabase
                .from('subcontractors')
                .select('*')
                .eq('id', selectedSubcontractorId)
                .single();

            const { data: cosData } = await supabase
                .from('change_orders')
                .select('*')
                .eq('subcontractor_id', selectedSubcontractorId)
                .order('date', { ascending: false });

            if (cosData) setCos(cosData);

            const approvedCOs = cosData?.filter(co => co.status === 'approved').reduce((acc, co) => acc + Number(co.amount), 0) || 0;

            setContract({
                original: Number(sub?.original_contract_value || 0),
                current: Number(sub?.original_contract_value || 0) + approvedCOs
            });

            setLoading(false);
        }
        loadFinancials();
    }, [selectedSubcontractorId]);

    const handleAddCO = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.from('change_orders').insert([{
            subcontractor_id: selectedSubcontractorId,
            title: newCO.title,
            amount: newCO.amount,
            status: newCO.status
        }]).select();

        if (!error && data) {
            setCos([data[0], ...cos]);
            setShowModal(false);
            setNewCO({ title: '', amount: 0, status: 'open' });

            if (newCO.status === 'approved') {
                setContract({
                    ...contract,
                    current: contract.current + Number(newCO.amount)
                });
            }
        } else {
            alert('Kunne ikke lagre endringsmelding.');
        }
        setLoading(false);
    };

    if (!selectedSubcontractorId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                    <Calculator className="w-16 h-16 text-slate-300" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-700">Ingen underentreprenør valgt</h3>
                <p className="text-slate-500 text-center mt-3 font-medium">Vennligst velg en underentreprenør for å se økonomiressurser.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Økonomisk Kontroll</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Administrer kontraktsverdi og endringsmeldinger (EM)</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Registrer Endring
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 flex items-center relative overflow-hidden group hover:border-slate-300 transition-colors">
                    <div className="w-2 bg-slate-300 absolute left-0 top-0 bottom-0 group-hover:bg-slate-400 transition-colors" />
                    <div className="bg-slate-100 p-4 rounded-xl mr-5 flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                        <Calculator className="w-7 h-7 text-slate-500" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Opprinnelig Kontrakt</p>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">kr {contract.original.toLocaleString('no-NO')}</h2>
                    </div>
                </div>
                <div className="bg-primary-600 p-6 rounded-3xl shadow-lg shadow-primary-500/30 text-white flex items-center relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl pointer-events-none group-hover:opacity-10 transition-opacity" />
                    <div className="bg-primary-500/50 p-4 rounded-xl mr-5 flex-shrink-0 backdrop-blur-sm border border-primary-400/30">
                        <DollarSign className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-primary-200 uppercase tracking-widest mb-1">Nåværende Verdi</p>
                        <h2 className="text-4xl font-extrabold tracking-tight">kr {contract.current.toLocaleString('no-NO')}</h2>
                    </div>         </div>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-800 tracking-tight">Endringslogg (EM)</h3>
                </div>
                {loading ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : cos.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium">Ingen endringsmeldinger registrert.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200/60 bg-slate-50/30">
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Beskrivelse</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Sum</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Dato</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cos.map((co) => (
                                    <tr key={co.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6 font-bold text-slate-800">{co.title}</td>
                                        <td className={cn("py-4 px-6 text-right font-extrabold", co.amount < 0 ? 'text-red-600' : 'text-slate-900')}>
                                            {co.amount >= 0 ? '+' : '-'}kr {Math.abs(Number(co.amount)).toLocaleString('no-NO')}
                                        </td>
                                        <td className="py-4 px-6 space-y-2">
                                            <div className="flex justify-center">
                                                {co.status === 'approved' && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 border border-green-200/60">
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Godkjent
                                                    </span>
                                                )}
                                                {co.status === 'open' && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                                                        <Clock className="w-3.5 h-3.5 mr-1.5" /> Avventer
                                                    </span>
                                                )}
                                                {co.status === 'rejected' && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200/60">
                                                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Avslått
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                                {new Date(co.date).toLocaleDateString('no-NO')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add CO Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Ny Endringsmelding (EM)</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddCO} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Beskrivelse / Tittel</label>
                                <input
                                    type="text"
                                    required
                                    value={newCO.title}
                                    onChange={(e) => setNewCO({ ...newCO, title: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="F.eks. Tillegg for ekstra strømuttak"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Beløp (NOK) - bruk minus for fradrag</label>
                                <input
                                    type="number"
                                    required
                                    value={newCO.amount || ''}
                                    onChange={(e) => setNewCO({ ...newCO, amount: Number(e.target.value) })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                                <select
                                    value={newCO.status}
                                    onChange={(e) => setNewCO({ ...newCO, status: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                                >
                                    <option value="open">Avventer Svar</option>
                                    <option value="approved">Godkjent</option>
                                    <option value="rejected">Avslått</option>
                                </select>
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : 'Lagre EM'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
