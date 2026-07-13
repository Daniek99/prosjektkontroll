import { useSubcontractor } from '../contexts/SubcontractorContext';
import { ChevronDown, Briefcase } from 'lucide-react';

export default function SubcontractorSelector() {
    const { selectedSubcontractorId, setSelectedSubcontractorId, subcontractors } = useSubcontractor();

    if (subcontractors.length === 0) {
        return (
            <div className="text-xs font-semibold text-white/60 px-3 py-1.5 border border-white/10 rounded-xl bg-white/5">
                Ingen underentreprenører
            </div>
        );
    }

    return (
        <div className="relative flex items-center shrink-0">
            <div className="flex items-center bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/30 transition-all rounded-xl px-3 py-1.5 cursor-pointer relative shadow-sm">
                <Briefcase className="w-3.5 h-3.5 text-white/80 mr-1.5 flex-shrink-0" />
                <select
                    aria-label="Velg underentreprenør"
                    value={selectedSubcontractorId || ''}
                    onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                    className="appearance-none bg-transparent outline-none font-bold text-white text-xs pr-5 cursor-pointer focus:ring-0"
                >
                    {subcontractors.map((sub: any) => (
                        <option key={sub.id} value={sub.id} className="text-slate-800 bg-white font-medium">
                            {sub.company_name} ({sub.trade})
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 absolute right-2.5 pointer-events-none" />
            </div>
        </div>
    );
}
