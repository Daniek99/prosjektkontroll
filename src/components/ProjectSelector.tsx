import { useProject } from '../contexts/ProjectContext';
import { ChevronDown, FolderKanban } from 'lucide-react';

export default function ProjectSelector() {
    const { projects, selectedProjectId, setSelectedProjectId } = useProject();

    if (projects.length === 0) {
        return (
            <div className="text-xs font-semibold text-white/60 px-3 py-1.5 border border-white/10 rounded-xl bg-white/5">
                Ingen prosjekter
            </div>
        );
    }

    return (
        <div className="relative flex items-center shrink-0">
            <div className="flex items-center bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/30 transition-all rounded-xl px-3 py-1.5 cursor-pointer relative shadow-sm">
                <FolderKanban className="w-3.5 h-3.5 text-white/80 mr-1.5 flex-shrink-0" />
                <select
                    aria-label="Velg prosjekt"
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="appearance-none bg-transparent outline-none font-bold text-white text-xs pr-5 cursor-pointer focus:ring-0 max-w-[180px]"
                >
                    {projects.map((project) => (
                        <option key={project.id} value={project.id} className="text-slate-800 bg-white font-medium">
                            {project.name}
                        </option>
                    ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 absolute right-2.5 pointer-events-none" />
            </div>
        </div>
    );
}
