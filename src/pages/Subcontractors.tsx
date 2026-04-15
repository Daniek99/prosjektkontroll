import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, Edit2, CheckCircle2, X, Search, Loader2 } from 'lucide-react';
import { useSubcontractor } from '../contexts/SubcontractorContext';

export default function Subcontractors() {
    const { subcontractors, refreshSubcontractors } = useSubcontractor();
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [newSub, setNewSub] = useState<{ id?: string, company_name: string, trade: string, original_contract_value: number, org_number: string }>({ company_name: '', trade: '', original_contract_value: 0, org_number: '' });

    // Brønnøysund Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        setShowDropdown(true);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${query}`);
            const data = await res.json();
            setSearchResults(data._embedded?.enheter || []);
        } catch (e) {
            console.error('API Error', e);
        }
        setIsSearching(false);
    };

    const handleSelectCompany = (company: any) => {
        setNewSub({
            ...newSub,
            company_name: company.navn,
            org_number: company.organisasjonsnummer
        });
        setSearchQuery(company.navn);
        setShowDropdown(false);
    };

    const handleAddSub = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            company_name: newSub.company_name,
            trade: newSub.trade,
            original_contract_value: newSub.original_contract_value,
            org_number: newSub.org_number,
            status: 'active'
        };

        let result;
        if (newSub.id) {
            result = await supabase.from('subcontractors').update(payload).eq('id', newSub.id);
        } else {
            result = await supabase.from('subcontractors').insert([payload]);
        }
        const { error } = result;

        if (!error) {
            await refreshSubcontractors();
            setShowModal(false);
            setNewSub({ company_name: '', trade: '', original_contract_value: 0, org_number: '' });
            setSearchQuery('');
        } else {
            alert('Kunne ikke lagre underentreprenør. Sjekk at du har kjørt SQL-scriptet.');
        }
        setLoading(false);
    };

    const handleEditClick = (sub: any) => {
        setNewSub({
            id: sub.id,
            company_name: sub.company_name,
            trade: sub.trade,
            original_contract_value: sub.original_contract_value,
            org_number: sub.org_number || ''
        });
        setSearchQuery(sub.company_name);
        setShowModal(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Underentreprenører</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Administrer alle aktive underentreprenører på dette prosjektet</p>
                </div>
                <button
                    onClick={() => {
                        setNewSub({ company_name: '', trade: '', original_contract_value: 0, org_number: '' });
                        setSearchQuery('');
                        setShowModal(true);
                    }}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Legg til underentreprenør
                </button>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden min-h-[400px]">
                {loading && subcontractors.length === 0 ? (
                    <div className="p-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
                ) : subcontractors.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium border-dashed border-2 border-slate-200 m-6 rounded-2xl bg-slate-50/50">
                        Ingen underentreprenører lagt til enda. Klikk på knappen over for å legge til en.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200/60">
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Firmanavn</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Fag</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Opprinnelig Kontrakt</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                                    <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Handlinger</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subcontractors.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center">
                                                <div className="bg-blue-50 p-2 rounded-lg mr-3 shadow-sm border border-blue-100/50">
                                                    <Users className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{sub.company_name}</div>
                                                    {sub.org_number && (
                                                        <div className="text-xs font-medium text-slate-500">Org: {sub.org_number}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                {sub.trade}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-slate-700 text-right">
                                            <span className="text-slate-400 font-medium mr-1">kr</span>
                                            {Number(sub.original_contract_value).toLocaleString('no-NO')}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-green-50 text-green-700 border border-green-100 p-1">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Aktiv
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right space-x-2">
                                            <button onClick={() => handleEditClick(sub)} className="text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors p-2 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-xl">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Subcontractor Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">{newSub.id ? 'Rediger Underentreprenør' : 'Ny Underentreprenør'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSub} className="p-6 space-y-5" onClick={() => setShowDropdown(false)}>
                            <div className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Søk i Brønnøysundregisteret</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        {isSearching ? <Loader2 className="h-5 w-5 text-slate-400 animate-spin" /> : <Search className="h-5 w-5 text-slate-400" />}
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        onClick={(e) => { e.stopPropagation(); setShowDropdown(true); }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                        placeholder="Søk på firmanavn..."
                                    />
                                </div>

                                {showDropdown && searchResults.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto">
                                        {searchResults.map((company) => (
                                            <div
                                                key={company.organisasjonsnummer}
                                                onClick={() => handleSelectCompany(company)}
                                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                            >
                                                <div className="font-bold text-slate-800">{company.navn}</div>
                                                <div className="text-xs text-slate-500 font-medium mt-0.5">Org.nr: {company.organisasjonsnummer}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Fag / Disiplin</label>
                                <input
                                    type="text"
                                    required
                                    value={newSub.trade}
                                    onChange={(e) => setNewSub({ ...newSub, trade: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="F.eks. Grunnarbeid, Tømrer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Opprinnelig Kontraktssum (NOK)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={newSub.original_contract_value || ''}
                                    onChange={(e) => setNewSub({ ...newSub, original_contract_value: Number(e.target.value) })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-400"
                                    placeholder="0"
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                                    Avbryt
                                </button>
                                <button disabled={loading} type="submit" className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 transition-colors disabled:opacity-50">
                                    {loading ? 'Lagrer...' : 'Lagre'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
