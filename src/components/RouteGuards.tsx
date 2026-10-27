import { Navigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import type { DatasetKey } from '../lib/datasets';
import { ShieldAlert } from 'lucide-react';

/** Renders children only when the current user can access the dataset. */
export function RequireDataset({ dataset, children }: { dataset: DatasetKey; children: React.ReactNode }) {
    const { canAccess } = useProject();

    if (!canAccess(dataset)) {
        // Avoid an infinite redirect loop on the default route.
        if (dataset === 'dashboard') {
            return (
                <div className="min-h-full flex items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl shadow-sm p-8 text-center">
                        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                            <ShieldAlert className="w-7 h-7 text-amber-500" />
                        </div>
                        <h2 className="text-lg font-extrabold text-slate-800">Ingen tilgang</h2>
                        <p className="text-sm text-slate-500 mt-2">
                            Du har ikke fått tilgang til noen datasett i dette prosjektet ennå.
                            Kontakt prosjektadministrator (masterbruker) for å få tilgang.
                        </p>
                    </div>
                </div>
            );
        }
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}

/** Renders children only for the master user. */
export function RequireMaster({ children }: { children: React.ReactNode }) {
    const { isMaster } = useProject();
    if (!isMaster) {
        return <Navigate to="/" replace />;
    }
    return <>{children}</>;
}