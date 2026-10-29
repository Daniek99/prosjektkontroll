import { ChevronDown, Filter } from 'lucide-react';
import { useSubcontractor } from '../contexts/SubcontractorContext';

type Props = {
    value: string | null;
    onChange: (id: string | null) => void;
    label?: string;
    className?: string;
};

// A page-local subcontractor selector. Each page owns its own selection so the
// main pages are independent of one another.
export default function PageSubcontractorSelector({ value, onChange, label = 'Underentreprenør', className }: Props) {
    const { subcontractors } = useSubcontractor();

    return (
        <div className={`flex items-center gap-2 ${className ?? ''}`}>
            <Filter className="w-4 h-4 text-primary-600 shrink-0" />
            <div className="relative min-w-0">
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    aria-label={`Velg ${label.toLowerCase()}`}
                    className="appearance-none w-full bg-white border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer"
                >
                    <option value="">Velg {label.toLowerCase()}</option>
                    {subcontractors.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
        </div>
    );
}
