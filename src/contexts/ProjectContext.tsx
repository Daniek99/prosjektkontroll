import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, setCurrentProjectId } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { DatasetKey } from '../lib/datasets';

export type Project = {
    id: string;
    name: string;
    description: string | null;
    is_default: boolean;
    created_by: string | null;
    created_at: string;
};

type ProjectContextType = {
    projects: Project[];
    selectedProjectId: string | null;
    selectedProject: Project | null;
    setSelectedProjectId: (id: string) => void;
    loading: boolean;
    isMaster: boolean;
    permissions: Record<string, boolean>;
    canAccess: (dataset: DatasetKey) => boolean;
    refreshProjects: () => Promise<void>;
    createProject: (name: string, description?: string) => Promise<Project | null>;
    renameProject: (id: string, name: string) => Promise<boolean>;
    needsNaming: boolean;
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const STORAGE_KEY = 'gc-app-selected-project';

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, isMaster, loading: authLoading, profileLoading } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);

    const loadPermissions = useCallback(async (projectId: string) => {
        const { data, error } = await supabase
            .from('user_dataset_permissions')
            .select('dataset, can_access')
            .eq('project_id', projectId);

        if (error) {
            console.error('Error loading dataset permissions', error);
            setPermissions({});
            return;
        }
        const map: Record<string, boolean> = {};
        (data ?? []).forEach((row: { dataset: string; can_access: boolean }) => {
            map[row.dataset] = row.can_access;
        });
        setPermissions(map);
    }, []);

    const loadProjects = useCallback(async () => {
        if (!user) {
            setProjects([]);
            setSelectedProjectIdState(null);
            setCurrentProjectId(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error loading projects', error);
            setProjects([]);
            setLoading(false);
            return;
        }

        const list = (data ?? []) as Project[];
        setProjects(list);

        if (list.length === 0) {
            setSelectedProjectIdState(null);
            setCurrentProjectId(null);
            setPermissions({});
            setLoading(false);
            return;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        const next = list.find((p) => p.id === stored)?.id ?? list[0].id;

        // Set the header synchronously BEFORE rendering children so that all
        // data queries are scoped to the selected project.
        setCurrentProjectId(next);
        setSelectedProjectIdState(next);
        localStorage.setItem(STORAGE_KEY, next);

        await loadPermissions(next);
        setLoading(false);
    }, [user, loadPermissions]);

    useEffect(() => {
        if (authLoading || profileLoading) return;
        loadProjects();
    }, [authLoading, profileLoading, loadProjects]);

    const setSelectedProjectId = useCallback((id: string) => {
        setCurrentProjectId(id);
        setSelectedProjectIdState(id);
        localStorage.setItem(STORAGE_KEY, id);
        loadPermissions(id);
    }, [loadPermissions]);

    const refreshProjects = useCallback(async () => {
        await loadProjects();
    }, [loadProjects]);

    const createProject = useCallback(async (name: string, description?: string) => {
        if (!user) return null;
        const { data, error } = await supabase
            .from('projects')
            .insert([{ name, description: description ?? null, created_by: user.id }])
            .select()
            .single();

        if (error) {
            console.error('Error creating project', error);
            return null;
        }

        const project = data as Project;
        setProjects((prev) => [...prev, project]);
        return project;
    }, [user]);

    const renameProject = useCallback(async (id: string, name: string) => {
        const { error } = await supabase
            .from('projects')
            .update({ name, is_default: false, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('Error renaming project', error);
            return false;
        }
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name, is_default: false } : p)));
        return true;
    }, []);

    const canAccess = useCallback((dataset: DatasetKey) => {
        if (isMaster) return true;
        return permissions[dataset] === true;
    }, [isMaster, permissions]);

    const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
    const needsNaming = isMaster && projects.some((p) => p.is_default);

    // Gate rendering until the project header is set. The login screen (no
    // user) is rendered immediately.
    const gated = !!user && (authLoading || profileLoading || loading);

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProjectId,
            selectedProject,
            setSelectedProjectId,
            loading,
            isMaster,
            permissions,
            canAccess,
            refreshProjects,
            createProject,
            renameProject,
            needsNaming,
        }}>
            {gated ? (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
                </div>
            ) : children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
