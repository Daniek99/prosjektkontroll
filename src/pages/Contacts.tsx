import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    Users,
    Plus,
    Mail,
    Phone,
    Briefcase,
    Search,
    X,
    Send,
    CheckSquare,
    Square
} from 'lucide-react';

interface Contact {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    subcontractor_id: string;
    subcontractors?: { company_name: string };
}

interface Subcontractor {
    id: string;
    company_name: string;
}

export default function Contacts() {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [isMultiEmailMode, setIsMultiEmailMode] = useState(false);

    // Form states
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: '', subcontractor_id: '' });

    useEffect(() => {
        if (user) loadContacts();
    }, [user]);

    async function loadContacts() {
        setLoading(true);

        const { data: subData } = await supabase.from('subcontractors').select('id, company_name').order('company_name');
        if (subData) setSubcontractors(subData);

        const { data, error } = await supabase
            .from('contacts')
            .select(`*, subcontractors(company_name)`)
            .order('name');

        if (!error && data) {
            setContacts(data);
        }
        setLoading(false);
    }

    async function handleAddContact(e: React.FormEvent) {
        e.preventDefault();
        if (!user) return;

        const { data, error } = await supabase
            .from('contacts')
            .insert([{ ...contactForm, created_by: user.id }])
            .select()
            .single();

        if (!error && data) {
            setContacts([...contacts, data].sort((a, b) => a.name.localeCompare(b.name)));
            setIsContactModalOpen(false);
            setContactForm({ name: '', email: '', phone: '', role: '', subcontractor_id: '' });
            loadContacts(); // reload to get the joined subcontractor name
        }
    }

    async function handleSendEmail(e: React.FormEvent) {
        e.preventDefault();
        
        // Get recipients based on mode
        const recipients = isMultiEmailMode 
            ? contacts.filter(c => selectedContacts.has(c.id)).map(c => c.email)
            : selectedContact ? [selectedContact.email] : [];
        
        if (recipients.length === 0) return;

        setIsSending(true);
        try {
            // This is a direct client-side fetch to Resend api for demonstration.
            // In a real production app, this should go through a Supabase Edge Function to protect the API Key.
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY || 're_mock_key'}`
                },
                body: JSON.stringify({
                    from: 'Prosjektkontroll <onboarding@resend.dev>', // Default resend testing email
                    to: recipients,
                    subject: emailSubject,
                    html: `<div style="font-family: sans-serif;">${emailBody.replace(/\n/g, '<br/>')}</div>`
                })
            });

            if (response.ok || !import.meta.env.VITE_RESEND_API_KEY) {
                // If API key is missing we simulate success for the demo playground
                setIsEmailModalOpen(false);
                setEmailSubject('');
                setEmailBody('');
                setSelectedContacts(new Set());
                setIsMultiEmailMode(false);
                alert(`E-post sendt til ${recipients.length} mottaker(e)!`);
            } else {
                const err = await response.json();
                console.error('Email sending failed', err);
                alert('Sending feilet. Sjekk console for detaljer.');
            }
        } catch (error) {
            console.error('Email error', error);
            // Simulate success for demonstration if not properly configured
            if (!import.meta.env.VITE_RESEND_API_KEY) {
                setIsEmailModalOpen(false);
                setEmailSubject('');
                setEmailBody('');
                setSelectedContacts(new Set());
                setIsMultiEmailMode(false);
                alert(`E-post "sendt" til ${recipients.length} mottaker(e)! (Siden API-nøkkel mangler, er dette kun en simulering)`);
            } else {
                alert('Feil ved sending: ' + String(error));
            }
        } finally {
            setIsSending(false);
        }
    }

    function openEmailModal(contact: Contact) {
        setSelectedContact(contact);
        setSelectedContacts(new Set([contact.id]));
        setIsMultiEmailMode(false);
        setIsEmailModalOpen(true);
    }

    function openMultiEmailModal() {
        if (selectedContacts.size === 0) return;
        const firstSelected = contacts.find(c => selectedContacts.has(c.id));
        setSelectedContact(firstSelected || null);
        setIsMultiEmailMode(true);
        setIsEmailModalOpen(true);
    }

    function toggleContactSelection(contactId: string) {
        const newSelection = new Set(selectedContacts);
        if (newSelection.has(contactId)) {
            newSelection.delete(contactId);
        } else {
            newSelection.add(contactId);
        }
        setSelectedContacts(newSelection);
    }

    function toggleSelectAllInGroup(groupContacts: Contact[]) {
        const allSelected = groupContacts.every(c => selectedContacts.has(c.id));
        const newSelection = new Set(selectedContacts);
        if (allSelected) {
            groupContacts.forEach(c => newSelection.delete(c.id));
        } else {
            groupContacts.forEach(c => newSelection.add(c.id));
        }
        setSelectedContacts(newSelection);
    }

    function clearSelection() {
        setSelectedContacts(new Set());
    }

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.subcontractors?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group contacts by subcontractor
    const groupedContacts = filteredContacts.reduce((acc, contact) => {
        const subName = contact.subcontractors?.company_name || 'Andre (Uten underentreprenør)';
        if (!acc[subName]) acc[subName] = [];
        acc[subName].push(contact);
        return acc;
    }, {} as Record<string, Contact[]>);

    // Sort groups alphabetically
    const sortedGroups = Object.keys(groupedContacts).sort();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kontakter</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">Håndter prosjektkontakter og send e-poster</p>
                </div>
                <button
                    onClick={() => setIsContactModalOpen(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center shadow-md shadow-primary-500/20"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Ny kontakt
                </button>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-4">
                    <div className="relative max-w-md flex-1">
                        <input
                            type="text"
                            placeholder="Søk på navn, firma eller rolle..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                        />
                        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    {selectedContacts.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-600">{selectedContacts.size} valgt</span>
                            <button
                                onClick={clearSelection}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                                title="Fjern valg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center border border-dashed border-slate-300 rounded-2xl bg-slate-50/50">
                        <Users className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700">Ingen kontakter funnet</h3>
                        <p className="text-slate-500 font-medium mt-1">Prøv et annet søk eller legg til en ny kontakt.</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {sortedGroups.map(groupName => (
                            <div key={groupName}>
                                <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
                                    <button
                                        onClick={() => toggleSelectAllInGroup(groupedContacts[groupName])}
                                        className="p-1 rounded hover:bg-slate-100 transition-colors"
                                        title={groupedContacts[groupName].every(c => selectedContacts.has(c.id)) ? 'Fjern valg for gruppen' : 'Velg alle i gruppen'}
                                    >
                                        {groupedContacts[groupName].every(c => selectedContacts.has(c.id)) ? (
                                            <CheckSquare className="w-5 h-5 text-primary-600" />
                                        ) : (
                                            <Square className="w-5 h-5 text-slate-400" />
                                        )}
                                    </button>
                                    <h2 className="text-xl font-extrabold text-slate-800">{groupName}</h2>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{groupedContacts[groupName].length}</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupedContacts[groupName].map(contact => (
                                        <div 
                                            key={contact.id} 
                                            className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-shadow relative group cursor-pointer ${
                                                selectedContacts.has(contact.id) 
                                                    ? 'border-primary-400 ring-2 ring-primary-100 bg-primary-50/30' 
                                                    : 'border-slate-200'
                                            }`}
                                            onClick={(e) => {
                                                // Toggle selection on click, unless clicking on a link or button
                                                const target = e.target as HTMLElement;
                                                if (target.closest('a') || target.closest('button')) return;
                                                toggleContactSelection(contact.id);
                                            }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleContactSelection(contact.id);
                                                        }}
                                                        className="p-0.5 rounded hover:bg-slate-100 transition-colors"
                                                    >
                                                        {selectedContacts.has(contact.id) ? (
                                                            <CheckSquare className="w-5 h-5 text-primary-600" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </button>
                                                    <h3 className="font-bold text-slate-900 text-lg">{contact.name}</h3>
                                                </div>
                                            </div>
                                            {contact.role && (
                                                <div className="flex items-center text-slate-500 text-sm mt-1 ml-7">
                                                    <Briefcase className="w-4 h-4 mr-2" />
                                                    {contact.role}
                                                </div>
                                            )}
                                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 ml-7">
                                                <div className="flex items-center text-slate-700 text-sm">
                                                    <Mail className="w-4 h-4 mr-2 text-primary-500" />
                                                    <a href={`mailto:${contact.email}`} className="hover:text-primary-600 truncate">{contact.email}</a>
                                                </div>
                                                {contact.phone && (
                                                    <div className="flex items-center text-slate-700 text-sm">
                                                        <Phone className="w-4 h-4 mr-2 text-primary-500" />
                                                        {contact.phone}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEmailModal(contact);
                                                }}
                                                className="absolute top-4 right-4 p-2 bg-primary-50 text-primary-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-100 hover:scale-105"
                                                title="Send e-post fra plattformen"
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Multi-Select Action Bar */}
            {selectedContacts.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom border border-slate-700">
                    <span className="font-bold text-sm text-slate-300 border-r border-slate-700 pr-4">
                        {selectedContacts.size} kontakt{selectedContacts.size > 1 ? 'er' : ''} valgt
                    </span>
                    <button
                        onClick={openMultiEmailModal}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Send e-post til alle
                    </button>
                    <button
                        onClick={clearSelection}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition-colors"
                        title="Fjern valg"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Email Modal */}
            {isEmailModalOpen && (selectedContact || selectedContacts.size > 0) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                                <Mail className="w-5 h-5 mr-2 text-primary-600" />
                                {isMultiEmailMode 
                                    ? `Send E-post til ${selectedContacts.size} mottakere`
                                    : `Send E-post til ${selectedContact?.name}`
                                }
                            </h3>
                            <button onClick={() => {
                                setIsEmailModalOpen(false);
                                setIsMultiEmailMode(false);
                            }} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full hover:bg-slate-200 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSendEmail} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">
                                        {isMultiEmailMode ? 'Til' : 'Til'}
                                    </label>
                                    {isMultiEmailMode ? (
                                        <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium max-h-32 overflow-y-auto">
                                            {contacts.filter(c => selectedContacts.has(c.id)).map((c, i, arr) => (
                                                <span key={c.id}>
                                                    {c.name} ({c.email}){i < arr.length - 1 ? ', ' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <input type="text" readOnly value={selectedContact?.email || ''} className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed" />
                                    )}
                                </div>
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Emne</label>
                                    <input type="text" required value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all outline-none" placeholder="Angi emne for e-posten..." />
                                </div>
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Melding</label>
                                    <textarea required rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all outline-none resize-none" placeholder="Skriv meldingen din her..." />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end gap-3">
                                <button type="button" onClick={() => {
                                    setIsEmailModalOpen(false);
                                    setIsMultiEmailMode(false);
                                }} className="px-5 py-2.5 font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">
                                    Avbryt
                                </button>
                                <button type="submit" disabled={isSending} className="px-5 py-2.5 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors flex items-center disabled:opacity-70 shadow-md shadow-primary-500/20">
                                    {isSending ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    ) : (
                                        <Send className="w-4 h-4 mr-2" />
                                    )}
                                    {isSending ? 'Sender...' : 'Send e-post'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Contact Modal */}
            {isContactModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-primary-600" />
                                Legg til ny kontakt
                            </h3>
                            <button onClick={() => setIsContactModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full hover:bg-slate-200 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddContact} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Navn <span className="text-red-500">*</span></label>
                                    <input required type="text" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="Ola Nordmann" />
                                </div>
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">E-post <span className="text-red-500">*</span></label>
                                    <input required type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="ola@example.com" />
                                </div>
                                <div>
                                    <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Telefon</label>
                                    <input type="tel" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="+47 123 45 678" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Underentreprenør</label>
                                        <div className="relative">
                                            <select
                                                value={contactForm.subcontractor_id}
                                                onChange={(e) => setContactForm({ ...contactForm, subcontractor_id: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 outline-none appearance-none cursor-pointer"
                                            >
                                                <option value="" disabled>Velg firma...</option>
                                                {subcontractors.map(sub => (
                                                    <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                <svg className="w-4 h-4 ml-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block tracking-wide text-xs font-bold text-slate-500 uppercase mb-2">Rolle</label>
                                        <input type="text" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-primary-500/50 outline-none" placeholder="Prosjektleder" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsContactModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors">
                                    Avbryt
                                </button>
                                <button type="submit" className="px-5 py-2.5 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-md shadow-primary-500/20">
                                    Lagre kontakt
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
