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
    subcontractors: Subcontractor[];
    setSubcontractors: React.Dispatch<React.SetStateAction<Subcontractor[]>>;
    refreshSubcontractors: () => Promise<void>;
};

const SubcontractorContext = createContext<SubcontractorContextType | undefined>(undefined);

export const SubcontractorProvider = ({ children }: { children: React.ReactNode }) => {
    const { selectedProjectId, loading: projectLoading } = useProject();
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);

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
            }
        } catch (err) {
            console.error(err);
        }
    }, [selectedProjectId]);

    useEffect(() => {
        if (projectLoading) return;
        refreshSubcontractors();
    }, [projectLoading, refreshSubcontractors]);

    return (
        <SubcontractorContext.Provider value={{
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
