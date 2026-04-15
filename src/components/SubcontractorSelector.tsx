import { useSubcontractor } from '../contexts/SubcontractorContext';
import { ChevronDown, Briefcase } from 'lucide-react';

export default function SubcontractorSelector() {
    const { selectedSubcontractorId, setSelectedSubcontractorId, subcontractors } = useSubcontractor();

    if (subcontractors.length === 0) return <div className="text-sm font-medium text-slate-400 px-4 py-2 border border-slate-200/50 rounded-xl bg-slate-100">Ingen underentreprenører</div>;

    return (
        <div className="relative group flex md:block w-full md:w-auto mt-2 md:mt-0 px-4 md:px-0">
            <div className="flex items-center w-full bg-slate-100 hover:bg-slate-200/80 transition-colors rounded-xl px-4 py-2 cursor-pointer border border-slate-200 relative">
                <Briefcase className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0" />
                <select
                    aria-label="Select Subcontractor"
                    value={selectedSubcontractorId || ''}
                    onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                    className="appearance-none bg-transparent outline-none font-bold text-slate-800 text-sm w-full md:w-auto pr-6 cursor-pointer"
                >
                    {subcontractors.map((sub: any) => (
                        <option key={sub.id} value={sub.id}>
                            {sub.company_name} ({sub.trade})
                        </option>
                    ))}
                    {subcontractors.length === 0 && (
                        <option value="" disabled>No Subcontractors</option>
                    )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
            </div>
        </div>
    );
}
