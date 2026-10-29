import { useEffect, useState } from 'react';
import { useSubcontractor } from '../contexts/SubcontractorContext';

// Per-page subcontractor selection. Pages that need a subcontractor-specific
// view own their selection locally instead of relying on a global header
// dropdown. The subcontractor list itself still comes from the project.
export function usePageSubcontractor() {
    const { subcontractors } = useSubcontractor();
    const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string | null>(null);

    useEffect(() => {
        if (subcontractors.length === 0) {
            setSelectedSubcontractorId(null);
            return;
        }
        if (!selectedSubcontractorId || !subcontractors.some((s) => s.id === selectedSubcontractorId)) {
            setSelectedSubcontractorId(subcontractors[0].id);
        }
    }, [subcontractors, selectedSubcontractorId]);

    return { selectedSubcontractorId, setSelectedSubcontractorId, subcontractors };
}
