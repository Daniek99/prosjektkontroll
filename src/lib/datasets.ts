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
    { key: 'diary', label: 'Notater' },
    { key: 'decisions', label: 'Prosjektering' },
    { key: 'contacts', label: 'Kontakter' },
    { key: 'statistics', label: 'Statistikk' },
] as const;

export type DatasetKey = (typeof DATASETS)[number]['key'];

export const DATASET_KEYS: DatasetKey[] = DATASETS.map((d) => d.key);

// The "Notater" (notes) section is a personal feature that belongs to the
// user's profile rather than to a specific project. Its access is stored on
// `user_profiles.notes_access` and it is therefore excluded from the
// per-project dataset grid.
export const NOTES_DATASET_KEY: DatasetKey = 'diary';

export const PROJECT_DATASETS = DATASETS.filter((d) => d.key !== NOTES_DATASET_KEY);
