import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { DATASETS, DATASET_KEYS, type DatasetKey } from '../lib/datasets';
import {
    Users, FolderKanban, Plus, Trash2, ShieldCheck, Mail, KeyRound,
    Loader2, Check, X, UserPlus, Settings2,
} from 'lucide-react';
import { cn } from '../lib/utils';

type ProfileRow = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: 'master' | 'user';
    created_at?: string;
};

type Membership = { project_id: string; user_id: string; role: string };
type PermRow = { user_id: string; project_id: string; dataset: string; can_access: boolean };

export default function UserManagement() {
    const { user } = useAuth();
    const {
        projects, selectedProjectId, setSelectedProjectId, createProject, renameProject, refreshProjects,
    } = useProject();

    const [tab, setTab] = useState<'users' | 'projects'>('users');
    const [profiles, setProfiles] = useState<ProfileRow[]>([]);
    const [memberships, setMemberships] = useState<Membership[]>([]);
    const [perms, setPerms] = useState<PermRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showInvite, setShowInvite] = useState(false);
    const [invite, setInvite] = useState({
        email: '',
        fullName: '',
        password: '',
        projectIds: [] as string[],
        datasets: [...DATASET_KEYS] as DatasetKey[],
    });

    const [newProject, setNewProject] = useState({ name: '', description: '' });
    const [renameValues, setRenameValues] = useState<Record<string, string>>({});

    const loadData = async () => {
        setLoading(true);
        const [profilesRes, membersRes, permsRes] = await Promise.all([
            supabase.from('user_profiles').select('*').order('created_at', { ascending: true }),
            supabase.from('project_members').select('*'),
            supabase.from('user_dataset_permissions').select('*'),
        ]);
        if (profilesRes.error) console.error(profilesRes.error);
        setProfiles((profilesRes.data ?? []) as ProfileRow[]);
        setMemberships((membersRes.data ?? []) as Membership[]);
        setPerms((permsRes.data ?? []) as PermRow[]);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (showInvite && invite.projectIds.length === 0 && selectedProjectId) {
            setInvite((prev) => ({ ...prev, projectIds: [selectedProjectId] }));
        }
    }, [showInvite, selectedProjectId, invite.projectIds.length]);

    const selectedUser = useMemo(
        () => profiles.find((p) => p.id === selectedUserId) ?? null,
        [profiles, selectedUserId]
    );

    const userMemberships = (userId: string) => memberships.filter((m) => m.user_id === userId);
    const isMember = (userId: string, projectId: string) =>
        memberships.some((m) => m.user_id === userId && m.project_id === projectId);
    const hasPerm = (userId: string, projectId: string, dataset: string) =>
        perms.some((p) => p.user_id === userId && p.project_id === projectId && p.dataset === dataset && p.can_access);

    const clearMessages = () => { setError(''); setSuccess(''); };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        if (!invite.email.trim()) { setError('E-post er påkrevd.'); return; }
        setBusy(true);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
                body: {
                    action: 'invite',
                    email: invite.email.trim(),
                    fullName: invite.fullName.trim() || undefined,
                    password: invite.password.trim() || undefined,
                    projectIds: invite.projectIds,
                    datasets: invite.datasets,
                },
            });
            if (fnError || (data && (data as { error?: string }).error)) {
                throw new Error(fnError?.message || (data as { error?: string }).error);
            }
            setSuccess(
                invite.password.trim()
                    ? 'Brukeren er opprettet med det angitte passordet.'
                    : 'Invitasjon er sendt på e-post.'
            );
            setShowInvite(false);
            setInvite({ email: '', fullName: '', password: '', projectIds: [], datasets: [...DATASET_KEYS] });
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kunne ikke opprette bruker.');
        } finally {
            setBusy(false);
        }
    };

    const toggleMembership = async (userId: string, projectId: string, next: boolean) => {
        clearMessages();
        setMemberships((prev) => next
            ? [...prev.filter((m) => !(m.user_id === userId && m.project_id === projectId)), { user_id: userId, project_id: projectId, role: 'member' }]
            : prev.filter((m) => !(m.user_id === userId && m.project_id === projectId)));

        if (next) {
            const { error: err } = await supabase
                .from('project_members')
                .upsert([{ user_id: userId, project_id: projectId, role: 'member' }], { onConflict: 'project_id,user_id' });
            if (err) { setError(err.message); await loadData(); }
        } else {
            const { error: err } = await supabase
                .from('project_members')
                .delete()
                .eq('user_id', userId)
                .eq('project_id', projectId);
            if (err) { setError(err.message); await loadData(); return; }
            await supabase
                .from('user_dataset_permissions')
                .delete()
                .eq('user_id', userId)
                .eq('project_id', projectId);
            setPerms((prev) => prev.filter((p) => !(p.user_id === userId && p.project_id === projectId)));
        }
    };

    const toggleDataset = async (userId: string, projectId: string, dataset: string, next: boolean) => {
        clearMessages();
        setPerms((prev) => next
            ? [...prev.filter((p) => !(p.user_id === userId && p.project_id === projectId && p.dataset === dataset)), { user_id: userId, project_id: projectId, dataset, can_access: true }]
            : prev.filter((p) => !(p.user_id === userId && p.project_id === projectId && p.dataset === dataset)));

        if (next) {
            const { error: err } = await supabase
                .from('user_dataset_permissions')
                .upsert([{ user_id: userId, project_id: projectId, dataset, can_access: true }], { onConflict: 'user_id,project_id,dataset' });
            if (err) { setError(err.message); await loadData(); }
        } else {
            const { error: err } = await supabase
                .from('user_dataset_permissions')
                .delete()
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .eq('dataset', dataset);
            if (err) { setError(err.message); await loadData(); }
        }
    };

    const handleDeleteUser = async (profile: ProfileRow) => {
        clearMessages();
        if (!confirm(`Slette brukeren ${profile.email}? Dette kan ikke angres.`)) return;
        setBusy(true);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
                body: { action: 'delete', userId: profile.id },
            });
            if (fnError || (data && (data as { error?: string }).error)) {
                throw new Error(fnError?.message || (data as { error?: string }).error);
            }
            setSuccess('Brukeren er slettet.');
            setSelectedUserId(null);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kunne ikke slette bruker.');
        } finally {
            setBusy(false);
        }
    };

    const handleResetPassword = async (profile: ProfileRow) => {
        clearMessages();
        const password = prompt(`Nytt passord for ${profile.email} (minst 6 tegn):`);
        if (!password) return;
        if (password.length < 6) { setError('Passordet må være minst 6 tegn.'); return; }
        setBusy(true);
        try {
            const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
                body: { action: 'update_password', userId: profile.id, password },
            });
            if (fnError || (data && (data as { error?: string }).error)) {
                throw new Error(fnError?.message || (data as { error?: string }).error);
            }
            setSuccess('Passordet er oppdatert.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Kunne ikke oppdatere passord.');
        } finally {
            setBusy(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        clearMessages();
        if (!newProject.name.trim()) { setError('Prosjektnavn er påkrevd.'); return; }
        setBusy(true);
        const created = await createProject(newProject.name.trim(), newProject.description.trim() || undefined);
        setBusy(false);
        if (created) {
            setSuccess(`Prosjektet «${created.name}» er opprettet.`);
            setNewProject({ name: '', description: '' });
            await refreshProjects();
        } else {
            setError('Kunne ikke opprette prosjektet.');
        }
    };

    const handleSaveProjectName = async (projectId: string) => {
        const value = renameValues[projectId];
        if (!value || !value.trim()) return;
        clearMessages();
        const ok = await renameProject(projectId, value.trim());
        if (ok) {
            setSuccess('Prosjektnavnet er oppdatert.');
            setRenameValues((prev) => ({ ...prev, [projectId]: '' }));
            await refreshProjects();
        } else {
            setError('Kunne ikke oppdatere prosjektnavnet.');
        }
    };

    return (
        <div className="space-y-6 max-w-full px-4 sm:px-6 lg:px-8 mx-auto pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
                        <Users className="w-6 h-6 mr-3 text-primary-600" />
                        Brukere & Prosjekter
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Administrer byggeprosjekter, inviter brukere og styr hvilke datasett de har tilgang til.
                    </p>
                </div>
                <button
                    onClick={() => { clearMessages(); setShowInvite(true); }}
                    className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-primary-700 hover:-translate-y-0.5 transition-all flex items-center shrink-0"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Inviter bruker
                </button>
            </div>

            {(error || success) && (
                <div className={cn(
                    'p-4 rounded-2xl text-sm font-semibold border',
                    error ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'
                )}>
                    {error || success}
                </div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={() => setTab('users')}
                    className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors',
                        tab === 'users' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    )}
                >
                    <Users className="w-4 h-4 mr-2" /> Brukere
                </button>
                <button
                    onClick={() => setTab('projects')}
                    className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors',
                        tab === 'projects' ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    )}
                >
                    <FolderKanban className="w-4 h-4 mr-2" /> Prosjekter
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-primary-600 animate-spin" /></div>
            ) : tab === 'projects' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 h-fit">
                        <h3 className="font-extrabold text-slate-800 mb-4 flex items-center">
                            <Plus className="w-5 h-5 mr-2 text-primary-500" /> Nytt byggeprosjekt
                        </h3>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Prosjektnavn <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    placeholder="F.eks. Veidekke Nord – Bygg A"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Beskrivelse</label>
                                <textarea
                                    rows={3}
                                    value={newProject.description}
                                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                    placeholder="Valgfri beskrivelse..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={busy}
                                className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                            >
                                {busy ? 'Oppretter...' : 'Opprett prosjekt'}
                            </button>
                        </form>
                    </div>

                    <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50">
                            <h3 className="font-extrabold text-slate-800 flex items-center">
                                <FolderKanban className="w-5 h-5 mr-2 text-primary-500" /> Alle prosjekter
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {projects.map((project) => (
                                <div key={project.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                defaultValue={project.name}
                                                onChange={(e) => setRenameValues((prev) => ({ ...prev, [project.id]: e.target.value }))}
                                                className="font-bold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 rounded-lg px-2 py-1 outline-none w-full max-w-md transition-all"
                                            />
                                            {project.is_default && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md shrink-0">
                                                    Standard
                                                </span>
                                            )}
                                            {project.id === selectedProjectId && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-100 text-primary-700 px-2 py-0.5 rounded-md shrink-0">
                                                    Aktiv
                                                </span>
                                            )}
                                        </div>
                                        {project.description && (
                                            <p className="text-xs text-slate-500 mt-1 px-2">{project.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleSaveProjectName(project.id)}
                                            disabled={!renameValues[project.id]?.trim()}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40"
                                        >
                                            Lagre navn
                                        </button>
                                        <button
                                            onClick={() => setSelectedProjectId(project.id)}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors"
                                        >
                                            Velg
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {projects.length === 0 && (
                                <div className="p-10 text-center text-slate-500 text-sm">Ingen prosjekter ennå.</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* User list */}
                    <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden h-fit">
                        <div className="px-5 py-4 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between">
                            <h3 className="font-extrabold text-slate-800 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-primary-500" /> Brukere
                            </h3>
                            <span className="text-xs font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">{profiles.length}</span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {profiles.map((profile) => (
                                <button
                                    key={profile.id}
                                    onClick={() => { clearMessages(); setSelectedUserId(profile.id); }}
                                    className={cn(
                                        'w-full text-left px-5 py-3.5 transition-colors flex items-center gap-3',
                                        selectedUserId === profile.id ? 'bg-primary-50' : 'hover:bg-slate-50'
                                    )}
                                >
                                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-bold text-slate-500">
                                            {(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-800 truncate">
                                            {profile.full_name || profile.email}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">{profile.email}</div>
                                    </div>
                                    {profile.role === 'master' ? (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md flex items-center shrink-0">
                                            <ShieldCheck className="w-3 h-3 mr-1" /> Master
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md shrink-0">
                                            Bruker
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Access management */}
                    <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
                        {!selectedUser ? (
                            <div className="p-12 text-center text-slate-500 text-sm">
                                Velg en bruker for å administrere prosjekt- og datasetttilgang.
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-5 border-b border-slate-200/60 bg-slate-50/50 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-extrabold text-slate-800 flex items-center">
                                            <Settings2 className="w-5 h-5 mr-2 text-primary-500" />
                                            {selectedUser.full_name || selectedUser.email}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">{selectedUser.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleResetPassword(selectedUser)}
                                            disabled={busy}
                                            className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center disabled:opacity-50"
                                        >
                                            <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Passord
                                        </button>
                                        {selectedUser.id !== user?.id && (
                                            <button
                                                onClick={() => handleDeleteUser(selectedUser)}
                                                disabled={busy}
                                                className="px-3 py-2 text-xs font-bold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center disabled:opacity-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Slett
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 space-y-5">
                                    {selectedUser.role === 'master' && (
                                        <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm font-semibold rounded-xl p-4 flex items-center">
                                            <ShieldCheck className="w-4 h-4 mr-2 shrink-0" />
                                            Masterbrukere har tilgang til alle prosjekter og alle datasett.
                                        </div>
                                    )}
                                    <p className="text-sm text-slate-500">
                                        Kryss av for hvilke prosjekter brukeren skal ha tilgang til, og hvilke datasett som er tilgjengelige i hvert prosjekt.
                                    </p>

                                    <div className="space-y-4">
                                        {projects.map((project) => {
                                            const member = selectedUser.role === 'master' || isMember(selectedUser.id, project.id);
                                            return (
                                                <div key={project.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                                                    <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={member}
                                                            disabled={selectedUser.role === 'master'}
                                                            onChange={(e) => toggleMembership(selectedUser.id, project.id, e.target.checked)}
                                                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                        <span className="font-bold text-sm text-slate-800 flex-1">{project.name}</span>
                                                        {project.id === selectedProjectId && (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-100 text-primary-700 px-2 py-0.5 rounded-md">Aktiv</span>
                                                        )}
                                                    </label>
                                                    {member && (
                                                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                            {DATASETS.map((dataset) => {
                                                                const allowed = selectedUser.role === 'master' || hasPerm(selectedUser.id, project.id, dataset.key);
                                                                return (
                                                                    <label
                                                                        key={dataset.key}
                                                                        className={cn(
                                                                            'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                                                                            allowed ? 'bg-primary-50 border-primary-100 text-primary-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                                        )}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={allowed}
                                                                            disabled={selectedUser.role === 'master'}
                                                                            onChange={(e) => toggleDataset(selectedUser.id, project.id, dataset.key, e.target.checked)}
                                                                            className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                                        />
                                                                        {allowed ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0 opacity-40" />}
                                                                        {dataset.label}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Invite modal */}
            {showInvite && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <Mail className="w-5 h-5 mr-2 text-primary-600" /> Inviter ny bruker
                            </h3>
                            <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleInvite} className="p-6 space-y-5 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">E-post <span className="text-red-500">*</span></label>
                                    <input
                                        type="email"
                                        required
                                        value={invite.email}
                                        onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                                        placeholder="navn@veidekke.no"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Fullt navn</label>
                                    <input
                                        type="text"
                                        value={invite.fullName}
                                        onChange={(e) => setInvite({ ...invite, fullName: e.target.value })}
                                        placeholder="Ola Nordmann"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Midlertidig passord (valgfritt)</label>
                                <input
                                    type="text"
                                    value={invite.password}
                                    onChange={(e) => setInvite({ ...invite, password: e.target.value })}
                                    placeholder="La stå tom for å sende e-postinvitasjon"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Uten passord sendes en invitasjonslenke på e-post. Med passord opprettes brukeren med en gang.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Prosjekttilgang</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {projects.map((project) => (
                                        <label key={project.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
                                            <input
                                                type="checkbox"
                                                checked={invite.projectIds.includes(project.id)}
                                                onChange={(e) => setInvite({
                                                    ...invite,
                                                    projectIds: e.target.checked
                                                        ? [...invite.projectIds, project.id]
                                                        : invite.projectIds.filter((id) => id !== project.id),
                                                })}
                                                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            {project.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Datasettilgang</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {DATASETS.map((dataset) => (
                                        <label
                                            key={dataset.key}
                                            className={cn(
                                                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors',
                                                invite.datasets.includes(dataset.key)
                                                    ? 'bg-primary-50 border-primary-100 text-primary-700'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={invite.datasets.includes(dataset.key)}
                                                onChange={(e) => setInvite({
                                                    ...invite,
                                                    datasets: e.target.checked
                                                        ? [...invite.datasets, dataset.key]
                                                        : invite.datasets.filter((d) => d !== dataset.key),
                                                })}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            {dataset.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-semibold border border-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInvite(false)}
                                    className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="flex-1 px-4 py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                                >
                                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                    {busy ? 'Oppretter...' : 'Opprett bruker'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}