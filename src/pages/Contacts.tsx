import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Plus, Mail, Phone, Search, X, CheckSquare, Square, Trash2, Edit2, ListPlus, ChevronDown, ChevronUp, Building2, Copy, Check } from 'lucide-react';

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    category: string;
    company: string;
    subcontractor_id: string;
    subcontractors?: { company_name: string };
}

interface Subcontractor {
    id: string;
    company_name: string;
}

interface BulkContact {
    name: string;
    email: string;
    phone: string;
    company: string;
}

export default function Contacts() {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterCompany, setFilterCompany] = useState('');
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [copySuccess, setCopySuccess] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [allCollapsed, setAllCollapsed] = useState(false);

    const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '', category: '', company: '' });
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', category: '', company: '' });
    const [newCustomCategory, setNewCustomCategory] = useState('');
    const [editCustomCategory, setEditCustomCategory] = useState('');

    // Bulk add state
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkCustomCategory, setBulkCustomCategory] = useState('');
    const [bulkEntries, setBulkEntries] = useState<BulkContact[]>([{ name: '', email: '', phone: '', company: '' }]);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkPasteText, setBulkPasteText] = useState('');
    const [showPasteArea, setShowPasteArea] = useState(false);

    useEffect(() => { if (user) loadContacts(); }, [user]);

    async function loadContacts() {
        setLoading(true);
        const { data: subData } = await supabase.from('subcontractors').select('id, company_name').order('company_name');
        if (subData) setSubcontractors(subData);
        const { data, error } = await supabase.from('contacts').select('*').order('name');
        if (!error && data) {
            setContacts(data);
            // Collapse all groups by default
            const cats = [...new Set(data.map((c: Contact) => c.category || 'Uten kategori'))];
            setCollapsedGroups(new Set(cats));
            setAllCollapsed(true);
        }
        setLoading(false);
    }

    async function handleAddContact(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;
        if (!contactForm.name.trim()) { alert('Navn er påkrevd.'); return; }
        if (!contactForm.email.trim() && !contactForm.phone.trim()) { alert('Vennligst fyll inn enten e-post eller telefonnummer.'); return; }
        const finalCategory = contactForm.category === '_custom_' ? newCustomCategory : contactForm.category;
        const payload = { ...contactForm, category: finalCategory, created_by: user.id, subcontractor_id: null };
        const { error } = await supabase.from('contacts').insert([payload]);
        if (!error) {
            setIsContactModalOpen(false);
            setContactForm({ name: '', email: '', phone: '', role: '', category: '', company: '' });
            setNewCustomCategory('');
            loadContacts();
        }
    }

    async function handleUpdateContact(id: string) {
        if (!editForm.name.trim()) return;
        const finalCategory = editForm.category === '_custom_' ? editCustomCategory : editForm.category;
        const { error } = await supabase.from('contacts').update({ name: editForm.name, email: editForm.email, phone: editForm.phone, role: editForm.role, category: finalCategory, company: editForm.company }).eq('id', id);
        if (!error) { setEditingContactId(null); setEditCustomCategory(''); loadContacts(); }
    }

    async function handleDeleteContact(id: string) {
        if (!confirm('Slett denne kontakten?')) return;
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (!error) loadContacts();
    }

    // Bulk add handlers
    function addBulkRow() {
        setBulkEntries([...bulkEntries, { name: '', email: '', phone: '', company: '' }]);
    }

    function removeBulkRow(index: number) {
        if (bulkEntries.length <= 1) return;
        setBulkEntries(bulkEntries.filter((_, i) => i !== index));
    }

    function updateBulkRow(index: number, field: keyof BulkContact, value: string) {
        const updated = [...bulkEntries];
        updated[index] = { ...updated[index], [field]: value };
        setBulkEntries(updated);
    }

    function parseBulkPaste() {
        if (!bulkPasteText.trim()) return;
        const text = bulkPasteText.trim();
        const parsed: BulkContact[] = [];
        const seenEmails = new Set<string>();

        // Pattern 1: "Name" <email> or Name <email> — with optional name
        const regexWithName = /"?([^"<;,\n]+?)"?\s*<([^>]+)>/g;
        let match;
        while ((match = regexWithName.exec(text)) !== null) {
            const name = match[1].trim();
            const email = match[2].trim().toLowerCase();
            if (email && !seenEmails.has(email)) {
                seenEmails.add(email);
                parsed.push({ name, email, phone: '', company: '' });
            }
        }

        // Pattern 2: bare emails without angle brackets, separated by ; or newlines
        // Only if no matches from pattern 1
        if (parsed.length === 0) {
            const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
            let emailMatch;
            while ((emailMatch = emailRegex.exec(text)) !== null) {
                const email = emailMatch[1].toLowerCase();
                if (!seenEmails.has(email)) {
                    seenEmails.add(email);
                    parsed.push({ name: '', email, phone: '', company: '' });
                }
            }
        }

        if (parsed.length === 0) {
            alert('Kunne ikke gjenkjenne kontakter. Prøv format: "Navn" <epost>; "Navn2" <epost2>');
            return;
        }

        // Append to existing entries instead of replacing
        const existing = bulkEntries.filter(e => e.name.trim() || e.email.trim() || e.phone.trim());
        setBulkEntries([...existing, ...parsed]);
        setBulkPasteText('');
        setShowPasteArea(false);
    }

    async function handleBulkSave() {
        if (!user) return;
        const finalCategory = bulkCategory === '_custom_' ? bulkCustomCategory : bulkCategory;
        const validEntries = bulkEntries.filter(e => (e.name.trim() || e.email.trim()) && (e.email.trim() || e.phone.trim()));
        if (validEntries.length === 0) { alert('Legg til minst én gyldig kontakt.'); return; }

        setBulkSaving(true);
        const payloads = validEntries.map(entry => ({
            name: entry.name.trim(),
            email: entry.email.trim(),
            phone: entry.phone.trim(),
            company: entry.company.trim(),
            role: '',
            category: finalCategory,
            created_by: user.id,
            subcontractor_id: null,
        }));

        const { error } = await supabase.from('contacts').insert(payloads);
        setBulkSaving(false);
        if (!error) {
            setIsBulkModalOpen(false);
            setBulkCategory('');
            setBulkCustomCategory('');
            setBulkEntries([{ name: '', email: '', phone: '', company: '' }]);
            loadContacts();
        } else {
            alert('Feil ved lagring: ' + error.message);
        }
    }

    async function handleBulkDelete() {
        if (selectedContacts.size === 0) return;
        if (!confirm(`Er du sikker på at du vil slette ${selectedContacts.size} kontakt(er)?`)) return;
        const ids = Array.from(selectedContacts);
        const { error } = await supabase.from('contacts').delete().in('id', ids);
        if (!error) {
            setSelectedContacts(new Set());
            loadContacts();
        }
    }

    function openMailClient() {
        const recipients = contacts.filter(c => selectedContacts.has(c.id) && c.email).map(c => c.email);
        if (recipients.length === 0) { alert('Ingen mottakere med e-post valgt.'); return; }
        window.location.href = `mailto:${recipients.join(';')}`;
    }

    async function copyEmailsForOutlook() {
        const recipients = contacts.filter(c => selectedContacts.has(c.id) && c.email).map(c => c.email.trim());
        if (recipients.length === 0) { alert('Ingen mottakere med e-post valgt.'); return; }
        const emailList = recipients.join('; ');
        try {
            await navigator.clipboard.writeText(emailList);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = emailList;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        }
    }

    function toggleContactSelection(id: string) {
        const s = new Set(selectedContacts);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedContacts(s);
    }

    function toggleAllGroups() {
        if (allCollapsed) {
            setCollapsedGroups(new Set());
            setAllCollapsed(false);
        } else {
            setCollapsedGroups(new Set(sortedGroups));
            setAllCollapsed(true);
        }
    }

    function toggleGroupCollapse(group: string) {
        const next = new Set(collapsedGroups);
        next.has(group) ? next.delete(group) : next.add(group);
        setCollapsedGroups(next);
        // Sync allCollapsed state
        const allGroupNames = sortedGroups;
        const newAllCollapsed = allGroupNames.every(g => next.has(g));
        setAllCollapsed(newAllCollapsed);
    }

    const filteredContacts = contacts.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.company?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole ? c.role?.toLowerCase().includes(filterRole.toLowerCase()) : true;
        const matchesCompany = filterCompany ? c.company?.toLowerCase().includes(filterCompany.toLowerCase()) : true;
        return matchesSearch && matchesRole && matchesCompany;
    });

    const existingCategories = [...new Set(contacts.map(c => c.category).filter(Boolean))].sort();
    const existingRoles = [...new Set(contacts.map(c => c.role).filter(Boolean))].sort();
    const existingCompanies = [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();

    const grouped = filteredContacts.reduce((acc, c) => {
        const g = c.category || 'Uten kategori';
        if (!acc[g]) acc[g] = [];
        acc[g].push(c);
        return acc;
    }, {} as Record<string, Contact[]>);
    const sortedGroups = Object.keys(grouped).sort();

    function renderCategoryOptions(selected: string) {
        return (
            <>
                <option value="">Ingen kategori</option>
                {subcontractors.map(s => (
                    <option key={s.id} value={s.company_name}>{s.company_name}</option>
                ))}
                {existingCategories.filter(c => !subcontractors.some(s => s.company_name === c)).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="_custom_">+ Legg til ny kategori...</option>
            </>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kontakter</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">{contacts.length} kontakter totalt · {sortedGroups.length} kategorier</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {selectedContacts.size > 0 && (
                        <>
                            <button onClick={copyEmailsForOutlook} className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
                                {copySuccess ? <><Check className="w-4 h-4" /> Kopiert!</> : <><Copy className="w-4 h-4" /> Kopier e-poster ({selectedContacts.size})</>}
                            </button>
                            <button onClick={openMailClient} className="bg-[#0078D4] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#006CBE] transition-colors">
                                <Mail className="w-4 h-4" /> Send e-post ({selectedContacts.size})
                            </button>
                        </>
                    )}
                    <button onClick={() => setIsBulkModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                        <ListPlus className="w-4 h-4" /> Legg til flere
                    </button>
                    <button onClick={() => setIsContactModalOpen(true)} className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-900 transition-colors">
                        <Plus className="w-4 h-4" /> Ny kontakt
                    </button>
                    {selectedContacts.size > 0 && (
                        <button onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-700 transition-colors">
                            <Trash2 className="w-4 h-4" /> Slett ({selectedContacts.size})
                        </button>
                    )}
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <input type="text" placeholder="Søk på navn, kategori, firma eller e-post..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50" />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="">Alle roller</option>
                        {existingRoles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50">
                        <option value="">Alle firmaer</option>
                        {existingCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {sortedGroups.length > 0 && (
                        <button onClick={toggleAllGroups} className="px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                            {allCollapsed ? 'Utvid alle' : 'Skjul alle'}
                        </button>
                    )}
                </div>
            </div>

            {/* Contact Categories Grid */}
            {loading ? (
                <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
            ) : sortedGroups.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
                    <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-sm">Ingen kontakter funnet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {sortedGroups.map(group => {
                        const isCollapsed = collapsedGroups.has(group);
                        return (
                        <div key={group} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
                            {/* Category Header with expand/collapse button */}
                            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <button onClick={() => {
                                    const allSel = grouped[group].every(c => selectedContacts.has(c.id));
                                    const s = new Set(selectedContacts);
                                    grouped[group].forEach(c => allSel ? s.delete(c.id) : s.add(c.id));
                                    setSelectedContacts(s);
                                }} className="p-0.5 rounded hover:bg-slate-100 shrink-0">
                                    {grouped[group].every(c => selectedContacts.has(c.id)) ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                                </button>
                                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider flex-1 truncate">{group}</h3>
                                <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{grouped[group].length}</span>
                                <button
                                    onClick={() => toggleGroupCollapse(group)}
                                    className="p-1 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
                                    title={isCollapsed ? 'Utvid' : 'Skjul'}
                                >
                                    {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
                                </button>
                            </div>

                            {/* Collapsible Contact List */}
                            {!isCollapsed && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                        <colgroup>
                                            <col style={{ width: '36px' }} />
                                            <col style={{ width: '22%' }} />
                                            <col style={{ width: '18%' }} />
                                            <col style={{ width: '14%' }} />
                                            <col style={{ width: '14%' }} />
                                            <col style={{ width: '14%' }} />
                                            <col style={{ width: '18%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="text-left py-1.5 pr-1"></th>
                                                <th className="text-left py-1.5 pr-2">Navn</th>
                                                <th className="text-left py-1.5 pr-2">E-post</th>
                                                <th className="text-left py-1.5 pr-2">Telefon</th>
                                                <th className="text-left py-1.5 pr-2">Rolle</th>
                                                <th className="text-left py-1.5 pr-2">Firma</th>
                                                <th className="text-right py-1.5 pl-1"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {grouped[group].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                                <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedContacts.has(c.id) ? 'bg-primary-50/50' : ''}`}>
                                                    <td className="py-2 pr-1">
                                                        <button onClick={() => toggleContactSelection(c.id)} className="p-0.5">
                                                            {selectedContacts.has(c.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary-600" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                                                        </button>
                                                    </td>
                                                    {editingContactId === c.id ? (
                                                        <>
                                                            <td className="py-1 pr-2"><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-primary-500" autoFocus /></td>
                                                            <td className="py-1 pr-2"><input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-primary-500" /></td>
                                                            <td className="py-1 pr-2"><input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-primary-500" /></td>
                                                            <td className="py-1 pr-2"><input value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-primary-500" /></td>
                                                            <td className="py-1 pr-2"><input value={editForm.company} onChange={e => setEditForm({ ...editForm, company: e.target.value })} className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-primary-500" placeholder="Firma" /></td>
                                                            <td className="py-1 pl-1 text-right">
                                                                <button onClick={() => handleUpdateContact(c.id)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700 mr-1">Lagre</button>
                                                                <button onClick={() => { setEditingContactId(null); setEditCustomCategory(''); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Avbryt</button>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="py-2 pr-2 font-bold text-slate-800 truncate text-[11px]" title={c.name}>{c.name}</td>
                                                            <td className="py-2 pr-2 text-slate-600 truncate text-[11px]" title={c.email || '—'}>{c.email || '—'}</td>
                                                            <td className="py-2 pr-2 text-slate-600 truncate text-[11px]" title={c.phone || '—'}>{c.phone || '—'}</td>
                                                            <td className="py-2 pr-2 text-slate-500 truncate text-[11px]" title={c.role || '—'}>{c.role || '—'}</td>
                                                            <td className="py-2 pr-2 text-slate-500 truncate text-[11px]" title={c.company || '—'}>{c.company || '—'}</td>
                                                            <td className="py-2 pl-1 text-right whitespace-nowrap">
                                                                {c.email && <button onClick={() => { setSelectedContacts(new Set([c.id])); openMailClient(); }} className="p-0.5 text-slate-400 hover:text-[#0078D4] rounded transition-colors inline-flex" title="Send e-post"><Mail className="w-3 h-3" /></button>}
                                                                <button onClick={() => { setEditingContactId(c.id); setEditForm({ name: c.name, email: c.email, phone: c.phone, role: c.role, category: c.category || '', company: c.company || '' }); }} className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors inline-flex" title="Rediger"><Edit2 className="w-3 h-3" /></button>
                                                                <button onClick={() => handleDeleteContact(c.id)} className="p-0.5 text-slate-400 hover:text-red-600 rounded transition-colors inline-flex" title="Slett"><Trash2 className="w-3 h-3" /></button>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
            )}

            {/* New Contact Modal */}
            {isContactModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-extrabold text-slate-800">Ny kontakt</h3>
                            <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-red-500 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAddContact} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Navn *</label>
                                <input type="text" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="Navn" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">E-post</label>
                                    <input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="epost@..." />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Telefon</label>
                                    <input type="tel" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="+47..." />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 -mt-2">Minst én av e-post eller telefon kreves.</p>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Firma</label>
                                <input type="text" value={contactForm.company} onChange={e => setContactForm({ ...contactForm, company: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="F.eks. Entreprenør AS" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Kategori</label>
                                    <select
                                        value={contactForm.category === '_custom_' ? '_custom_' : contactForm.category}
                                        onChange={e => {
                                            if (e.target.value === '_custom_') {
                                                setContactForm({ ...contactForm, category: '_custom_' });
                                            } else {
                                                setContactForm({ ...contactForm, category: e.target.value });
                                                setNewCustomCategory('');
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none"
                                    >
                                        {renderCategoryOptions(contactForm.category)}
                                    </select>
                                    {contactForm.category === '_custom_' && (
                                        <input type="text" value={newCustomCategory} onChange={e => setNewCustomCategory(e.target.value)} className="w-full mt-2 px-4 py-2.5 bg-white border border-primary-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="Skriv inn ny kategori..." autoFocus />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Rolle</label>
                                    <input type="text" value={contactForm.role} onChange={e => setContactForm({ ...contactForm, role: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="F.eks. Prosjektleder" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-4 py-2.5 font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm">Avbryt</button>
                                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl text-sm">Lagre</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Add Contacts Modal */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                    <ListPlus className="w-5 h-5 text-emerald-600" />
                                    Legg til flere kontakter
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">Legg inn flere kontakter under samme kategori. Fyll inn navn og minst én av e-post eller telefon.</p>
                            </div>
                            <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-red-500 p-1"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* Paste from email list */}
                            <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-primary-700 uppercase tracking-widest">Lim inn fra e-postliste</label>
                                    <button onClick={() => setShowPasteArea(!showPasteArea)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700 transition-colors">
                                        {showPasteArea ? 'Skjul' : 'Lim inn...'}
                                    </button>
                                </div>
                                {showPasteArea && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-slate-500">Lim inn en liste med navn og e-poster. Forventet format: <code className="bg-white px-1 rounded border border-slate-200">"Navn" &lt;epost&gt;</code> adskilt med semikolon, komma eller linjeskift.</p>
                                        <textarea
                                            value={bulkPasteText}
                                            onChange={e => setBulkPasteText(e.target.value)}
                                            className="w-full h-28 px-3 py-2 bg-white border border-primary-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary-500 outline-none resize-none font-mono"
                                            placeholder={'"Martine Linnestad" <martine.linnestad@obos.no>;\n"Knut Arne Johnsen" <Knut-Arne.Johnsen@veidekke.no>'}
                                        />
                                        <button
                                            type="button"
                                            onClick={parseBulkPaste}
                                            className="px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors"
                                        >
                                            Gjenkjenn kontakter
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Kategori for alle *</label>
                                <select value={bulkCategory === '_custom_' ? '_custom_' : bulkCategory} onChange={e => { if (e.target.value === '_custom_') { setBulkCategory('_custom_'); } else { setBulkCategory(e.target.value); setBulkCustomCategory(''); } }} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none">
                                    {renderCategoryOptions(bulkCategory)}
                                </select>
                                {bulkCategory === '_custom_' && (
                                    <input type="text" value={bulkCustomCategory} onChange={e => setBulkCustomCategory(e.target.value)} className="w-full mt-2 px-4 py-2.5 bg-white border border-primary-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="Skriv inn ny kategori..." />
                                )}
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kontakter</label>
                                    <span className="text-[10px] font-bold text-slate-400">{bulkEntries.filter(e => (e.name.trim() || e.email.trim()) && (e.email.trim() || e.phone.trim())).length} gyldige</span>
                                </div>
                                {bulkEntries.map((entry, idx) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <span className="text-xs font-bold text-slate-400 mt-2.5 w-5 text-center shrink-0">{idx + 1}</span>
                                        <input type="text" value={entry.name} onChange={e => updateBulkRow(idx, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Navn *" />
                                        <input type="email" value={entry.email} onChange={e => updateBulkRow(idx, 'email', e.target.value)} className="flex-[2] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary-500 outline-none" placeholder="E-post" />
                                        <input type="tel" value={entry.phone} onChange={e => updateBulkRow(idx, 'phone', e.target.value)} className="flex-[1.5] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Telefon" />
                                        <input type="text" value={entry.company} onChange={e => updateBulkRow(idx, 'company', e.target.value)} className="flex-[2] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Firma" />
                                        <button type="button" onClick={() => removeBulkRow(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors shrink-0" disabled={bulkEntries.length <= 1}><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ))}
                                <button type="button" onClick={addBulkRow} className="w-full py-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-dashed border-emerald-200">+ Legg til rad</button>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsBulkModalOpen(false)} className="px-4 py-2.5 font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 text-sm">Avbryt</button>
                            <button onClick={handleBulkSave} disabled={bulkSaving || !bulkCategory || (bulkCategory === '_custom_' && !bulkCustomCategory.trim())} className="px-5 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm disabled:opacity-50 transition-colors">
                                {bulkSaving ? 'Lagrer...' : `Lagre ${bulkEntries.filter(e => (e.name.trim() || e.email.trim()) && (e.email.trim() || e.phone.trim())).length} kontakter`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy success toast */}
            {copySuccess && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <div>
                        <p className="font-bold text-sm">E-poster kopiert til utklippstavle!</p>
                        <p className="text-xs text-slate-300 mt-0.5">Lim inn i CC- eller BCC-feltet i Outlook</p>
                    </div>
                </div>
            )}
        </div>
    );
}
