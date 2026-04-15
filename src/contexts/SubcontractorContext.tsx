import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Subcontractor = {
    id: string;
    company_name: string;
    trade: string;
    original_contract_value?: number;
    status?: string;
    org_number?: string;
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
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(() => {
        return localStorage.getItem('gc-app-selected-sub') || null;
    });

    const refreshSubcontractors = async () => {
        try {
            const { data, error } = await supabase
                .from('subcontractors')
                .select('*')
                .order('company_name');

            if (!error && data) {
                setSubcontractors(data);
                // Auto-select first if none selected
                if (data.length > 0 && !localStorage.getItem('gc-app-selected-sub')) {
                    setSelectedSubcontractorId(data[0].id);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        refreshSubcontractors();
    }, []);

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
