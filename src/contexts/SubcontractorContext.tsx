import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from './ProjectContext';

type Subcontractor = {
    id: string;
    company_name: string;
    trade: string;
    original_contract_value?: number;
    status?: string;
    org_number?: string;
    type?: string;
};

type SubcontractorContextType = {
    selectedSubcontractorId: string | null;
    setSelectedSubcontractorId: (id: string | null) => void;
    subcontractors: Subcontractor[];
    setSubcontractors: React.Dispatch<React.SetStateAction<Subcontractor[]>>;
    refreshSubcontractors: () => Promise<void>;
};

const SubcontractorContext = createContext<SubcontractorContextType | undefined>(undefined);

export const SubcontractorProvider = ({ children }: { children: React.ReactNode }) => {
    const { selectedProjectId, loading: projectLoading } = useProject();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(() => {
        return localStorage.getItem('gc-app-selected-sub') || null;
    });

    const refreshSubcontractors = useCallback(async () => {
        if (!selectedProjectId) {
            setSubcontractors([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('subcontractors')
                .select('*')
                .order('company_name');

            if (!error && data) {
                setSubcontractors(data);
                // Keep the current selection if it still exists in this project,
                // otherwise auto-select the first subcontractor.
                setSelectedSubcontractorId((current) => {
                    if (current && data.some((s) => s.id === current)) return current;
                    return data.length > 0 ? data[0].id : null;
                });
            }
        } catch (err) {
            console.error(err);
        }
    }, [selectedProjectId]);

    useEffect(() => {
        if (projectLoading) return;
        refreshSubcontractors();
    }, [projectLoading, refreshSubcontractors]);

    useEffect(() => {
        if (selectedSubcontractorId) {
            localStorage.setItem('gc-app-selected-sub', selectedSubcontractorId);
        } else {
            localStorage.removeItem('gc-app-selected-sub');
        }
    }, [selectedSubcontractorId]);

    return (
        <SubcontractorContext.Provider value={{
            selectedSubcontractorId,
            setSelectedSubcontractorId,
            subcontractors,
            setSubcontractors,
            refreshSubcontractors
        }}>
            {children}
        </SubcontractorContext.Provider>
    );
};

export const useSubcontractor = () => {
    const context = useContext(SubcontractorContext);
    if (context === undefined) {
        throw new Error('useSubcontractor must be used within a SubcontractorProvider');
    }
    return context;
};
