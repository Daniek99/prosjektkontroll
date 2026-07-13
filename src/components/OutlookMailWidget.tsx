import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Send, Users, X, ExternalLink } from 'lucide-react';

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    category?: string;
    company?: string;
    subcontractor_id: string;
    subcontractors?: { company_name: string };
}

export default function OutlookMailWidget() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadContacts();
    }, []);

    async function loadContacts() {
        setLoading(true);
        const { data, error } = await supabase
            .from('contacts')
            .select('*, subcontractors(company_name)')
            .order('name');
        if (!error && data) setContacts(data);
        setLoading(false);
    }

    function toggleSelect(id: string) {
        const s = new Set(selectedIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedIds(s);
    }

    function selectAll() {
        const s = new Set(contacts.map(c => c.id));
        setSelectedIds(s);
    }

    function toggleGroupSelect(groupContacts: Contact[]) {
        const groupIds = groupContacts.map(c => c.id);
        const allSelected = groupIds.every(id => selectedIds.has(id));
        const s = new Set(selectedIds);
        if (allSelected) {
            groupIds.forEach(id => s.delete(id));
        } else {
            groupIds.forEach(id => s.add(id));
        }
        setSelectedIds(s);
    }

    function openOutlook() {
        const recipients = contacts.filter(c => selectedIds.has(c.id) && c.email).map(c => c.email).join(';');
        if (!recipients) { alert('Ingen mottakere med e-post valgt.'); return; }
        window.location.href = `mailto:${recipients}`;
    }

    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
    const grouped = contacts.reduce((acc, c) => {
        const g = c.category || 'Uten kategori';
        if (!acc[g]) acc[g] = [];
        acc[g].push(c);
        return acc;
    }, {} as Record<string, Contact[]>);
    const sortedGroups = Object.keys(grouped).sort();

    return (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                    <div className="bg-blue-50 p-2 rounded-xl mr-3">
                        <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-800">Kontaktpersoner</h3>
                        <p className="text-[10px] text-slate-400 font-medium">{selectedIds.size > 0 ? `${selectedIds.size} valgt` : `${contacts.length} totalt`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={() => setExpanded(!expanded)} className="px-2.5 py-1 bg-primary-50 text-primary-600 rounded-lg text-[10px] font-bold hover:bg-primary-100 transition-colors flex items-center gap-1">
                            <Send className="w-3 h-3" /> Send
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                        {expanded ? 'Mindre' : 'Mer'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div></div>
            ) : contacts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">Ingen kontakter.</p>
            ) : (
                <>
                    {expanded ? (
                        /* Expanded view — grouped by category, similar to the Contacts page */
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
                            {sortedGroups.map(group => (
                                <div key={group} className="bg-slate-50/70 border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
                                        <input
                                            type="checkbox"
                                            checked={grouped[group].every(c => selectedIds.has(c.id))}
                                            onChange={() => toggleGroupSelect(grouped[group])}
                                            className="w-3 h-3 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                            title="Velg alle i denne gruppen"
                                        />
                                        <h4 className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest flex-1 truncate">{group}</h4>
                                        <span className="text-[9px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{grouped[group].length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {grouped[group].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                            <label key={c.id} className={`flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-colors ${selectedIds.has(c.id) ? 'bg-primary-50' : 'hover:bg-white'}`}>
                                                <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3 h-3 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                                                <span className="text-xs font-bold text-slate-800 truncate flex-1">{c.name}</span>
                                                {c.email && <Mail className="w-3 h-3 text-slate-300 shrink-0" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Compact view — first contacts */
                        <div className="space-y-1">
                            {contacts.slice(0, 3).map(c => (
                                <label key={c.id} className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${selectedIds.has(c.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-3 h-3 text-primary-600 border-slate-300 rounded focus:ring-primary-500" />
                                    <span className="text-xs font-bold text-slate-800 truncate flex-1">{c.name}</span>
                                    {c.email && <Mail className="w-3 h-3 text-slate-300 shrink-0" />}
                                </label>
                            ))}
                        </div>
                    )}
                    {contacts.length > 3 && !expanded && (
                        <button onClick={() => setExpanded(true)} className="w-full mt-2 py-1.5 text-[10px] font-bold text-primary-600 hover:text-primary-700 text-center">
                            +{contacts.length - 3} flere kontakter
                        </button>
                    )}

                    {/* Select all / none */}
                    {contacts.length > 1 && (
                        <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                            <button onClick={selectAll} className="text-[10px] font-bold text-slate-400 hover:text-primary-600">
                                {selectedIds.size === contacts.length ? 'Fjern alle' : 'Velg alle'}
                            </button>
                            {selectedIds.size > 0 && (
                                <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-bold text-red-400 hover:text-red-600">
                                    Fjern valg
                                </button>
                            )}
                        </div>
                    )}

                    {/* Expanded send form */}
                    {expanded && selectedIds.size > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                            <div className="flex gap-2">
                                <button onClick={openOutlook} className="flex-1 py-2 bg-[#0078D4] text-white text-xs font-bold rounded-lg hover:bg-[#006CBE] transition-colors flex items-center justify-center gap-1.5">
                                    <ExternalLink className="w-3 h-3" /> Åpne i Outlook
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
