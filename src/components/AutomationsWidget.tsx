import { useEffect, useMemo, useState } from 'react';
import {
    Bot,
    Mail,
    FileText,
    Bell,
    Receipt,
    Workflow,
    Plus,
    type LucideIcon,
} from 'lucide-react';

/**
 * Automations panel — shows which automations are active and which are not.
 *
 * Placeholder implementation:
 *  - "enabled" state is persisted to localStorage only (no backend yet).
 *  - The first automation ("Dalux-operasjoner") is the real one; its Playwright
 *    logic lives in /dalux-automation and will be wired up when the details land.
 *  - The remaining entries are placeholders for automations to come.
 */

interface AutomationDef {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    defaultEnabled: boolean;
    /** Not implemented yet — shown as "Kommer" and the toggle is disabled. */
    comingSoon?: boolean;
    /** Small badge, e.g. the engine used. */
    tag?: string;
}

const AUTOMATIONS: AutomationDef[] = [
    {
        id: 'dalux-operations',
        name: 'Dalux-operasjoner',
        description:
            'Utfører automatiserte handlinger i Dalux Build via Playwright. Aktiveres når detaljene for operasjonene er klare.',
        icon: Bot,
        defaultEnabled: false,
        tag: 'Playwright',
    },
    {
        id: 'email-reminders',
        name: 'E-postpåminnelser',
        description:
            'Sender automatiske påminnelser når frister og oppstarter nærmer seg.',
        icon: Mail,
        defaultEnabled: false,
        comingSoon: true,
    },
    {
        id: 'weekly-report',
        name: 'Fremdriftsrapport',
        description:
            'Genererer og distribuerer ukentlig fremdriftsrapport til prosjektledelsen.',
        icon: FileText,
        defaultEnabled: false,
        comingSoon: true,
    },
    {
        id: 'contract-expiry',
        name: 'Kontraktsvarsling',
        description:
            'Varsler når underentreprenørkontrakter nærmer seg utløpsdato.',
        icon: Bell,
        defaultEnabled: false,
        comingSoon: true,
    },
    {
        id: 'invoice-export',
        name: 'Fakturaeksport',
        description:
            'Eksporterer godkjente endringsmeldinger til regnskapssystemet.',
        icon: Receipt,
        defaultEnabled: false,
        comingSoon: true,
    },
];

const STORAGE_KEY = 'gc_automations_state';

export default function AutomationsWidget() {
    const [enabled, setEnabled] = useState<Record<string, boolean>>(() => {
        const base: Record<string, boolean> = {};
        AUTOMATIONS.forEach((a) => {
            base[a.id] = a.defaultEnabled;
        });
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw) as Record<string, boolean>;
                Object.keys(base).forEach((id) => {
                    if (typeof saved[id] === 'boolean') base[id] = saved[id];
                });
            }
        } catch {
            /* ignore malformed / unavailable storage */
        }
        return base;
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
        } catch {
            /* ignore */
        }
    }, [enabled]);

    const readyCount = useMemo(
        () => AUTOMATIONS.filter((a) => !a.comingSoon).length,
        []
    );
    const activeCount = useMemo(
        () => AUTOMATIONS.filter((a) => !a.comingSoon && enabled[a.id]).length,
        [enabled]
    );

    const toggle = (a: AutomationDef) => {
        if (a.comingSoon) return;
        setEnabled((prev) => ({ ...prev, [a.id]: !prev[a.id] }));
    };

    return (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
                    <Workflow className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Automasjoner</h2>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                        {activeCount} av {readyCount} aktive
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {AUTOMATIONS.map((a) => {
                    const isActive = !a.comingSoon && enabled[a.id];
                    const Icon = a.icon;

                    const rowClasses = a.comingSoon
                        ? 'border-dashed border-slate-200 bg-slate-50/50'
                        : isActive
                            ? 'border-green-200 bg-green-50/60'
                            : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70';

                    const iconWrapClasses = a.comingSoon
                        ? 'bg-slate-100 text-slate-400'
                        : isActive
                            ? 'bg-green-100 text-green-600'
                            : 'bg-white text-slate-400 border border-slate-200';

                    const statusClasses = a.comingSoon
                        ? 'bg-amber-100 text-amber-700'
                        : isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-200 text-slate-600';

                    const statusLabel = a.comingSoon
                        ? 'Kommer'
                        : isActive
                            ? 'Aktiv'
                            : 'Inaktiv';

                    return (
                        <div
                            key={a.id}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${rowClasses}`}
                        >
                            <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconWrapClasses}`}
                            >
                                <Icon className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h3
                                        className={`text-sm font-bold truncate ${
                                            a.comingSoon ? 'text-slate-500' : 'text-slate-800'
                                        }`}
                                    >
                                        {a.name}
                                    </h3>
                                    {a.tag && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 shrink-0">
                                            {a.tag}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 leading-snug mt-0.5 line-clamp-2">
                                    {a.description}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span
                                    className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusClasses}`}
                                >
                                    {statusLabel}
                                </span>

                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isActive}
                                    aria-label={`${isActive ? 'Slå av' : 'Slå på'} ${a.name}`}
                                    disabled={a.comingSoon}
                                    onClick={() => toggle(a)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                        a.comingSoon
                                            ? 'bg-slate-200 cursor-not-allowed'
                                            : isActive
                                                ? 'bg-primary-500'
                                                : 'bg-slate-300 hover:bg-slate-400'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                            isActive ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add new (placeholder) */}
            <button
                type="button"
                disabled
                className="w-full mt-3 py-2 text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
                <Plus className="w-3.5 h-3.5" /> Legg til automasjon
            </button>
        </div>
    );
}
