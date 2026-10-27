// Predefined datasets (modules) that the master user can grant access to.
// The keys are stored in the `user_dataset_permissions` table and must stay
// in sync with the navigation items in Layout.tsx.

export const DATASETS = [
    { key: 'dashboard', label: 'Oversikt' },
    { key: 'setup', label: 'Prosjektoppsett' },
    { key: 'subcontractors', label: 'Underentreprenører' },
    { key: 'contracts', label: 'Kontraktdetaljer' },
    { key: 'progress', label: 'Fremdrift' },
    { key: 'financials', label: 'Økonomi' },
    { key: 'risks', label: 'Risikostyring' },
    { key: 'bemanning', label: 'Bemanning' },
    { key: 'areas', label: 'Områder' },
    { key: 'diary', label: 'Dagbok' },
    { key: 'decisions', label: 'Prosjektering' },
    { key: 'contacts', label: 'Kontakter' },
    { key: 'statistics', label: 'Statistikk' },
] as const;

export type DatasetKey = (typeof DATASETS)[number]['key'];

export const DATASET_KEYS: DatasetKey[] = DATASETS.map((d) => d.key);
