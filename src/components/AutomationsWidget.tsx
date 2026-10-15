import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Bot,
    Printer,
    Mail,
    FileText,
    Bell,
    Receipt,
    Workflow,
    Plus,
    Clock,
    Play,
    Loader2,
    type LucideIcon,
} from 'lucide-react';
import {
    listAutomations,
    setAutomationEnabled,
    requestAutomationRun,
    readCachedAutomations,
    type AutomationState,
} from '../lib/automations';

/**
 * Automations panel — shows which automations are active and which are not.
 *
 * The on/off flag is stored in Supabase (table `automations`) so the local
 * Playwright scheduler (dalux-automation) can read it outside the browser.
 * A localStorage cache mirrors the state for offline/fallback rendering.
 *
 * "Kjør nå" asks the scheduler to run the automation immediately, bypassing
 * the cron schedule. The scheduler polls for `run_requested_at`, clears it and
 * executes the script — so the scheduler process must be running.
 *
 * Live progress: the scheduler writes `run_status` (queued → running → done |
 * failed) and `run_progress` (the latest line from the script) to the row; this
 * panel polls for it so you can see what is currently running.
 *
 * "Vernerunde purring" and "Vernerunde utskrift" are real automations
 * (Playwright, Dalux Field). They are DISABLED by default until the setup is
 * fully complete. The remaining entries are placeholders for automations to come.
 */

interface AutomationDef {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    /** Not implemented yet — shown as "Kommer" and the toggle is disabled. */
    comingSoon?: boolean;
    /** Small badge, e.g. the engine used. */
    tag?: string;
    /** Human-readable schedule, e.g. "Onsdager 14:00". */
    scheduleLabel?: string;
}

const AUTOMATIONS: AutomationDef[] = [
    {
        id: 'vernerunde-purring',
        name: 'Vernerunde purring',
        description:
            'Sender purring for oransje (uferdige) oppgaver i Verne- og miljørunde i Dalux Field.',
        icon: Bot,
        tag: 'Playwright',
        scheduleLabel: 'Onsdager 14:00',
    },
    {
        id: 'vernerunde-utskrift',
        name: 'Vernerunde utskrift',
        description:
            'Skriver ut Håndverkerrapport (Enkel) for nyeste vernerunde, lagrer PDF-en i HMS15 Verneprotokoll og lager e-postutkast.',
        icon: Printer,
        tag: 'Playwright',
        scheduleLabel: 'Tirsdager 08:00',
    },
    {
        id: 'email-reminders',
        name: 'E-postpåminnelser',
        description:
            'Sender automatiske påminnelser når frister og oppstarter nærmer seg.',
        icon: Mail,
        comingSoon: true,
    },
    {
        id: 'weekly-report',
        name: 'Fremdriftsrapport',
        description:
            'Genererer og distribuerer ukentlig fremdriftsrapport til prosjektledelsen.',
        icon: FileText,
        comingSoon: true,
    },
    {
        id: 'contract-expiry',
        name: 'Kontraktsvarsling',
        description:
            'Varsler når underentreprenørkontrakter nærmer seg utløpsdato.',
        icon: Bell,
        comingSoon: true,
    },
    {
        id: 'invoice-export',
        name: 'Fakturaeksport',
        description:
            'Eksporterer godkjendte endringsmeldinger til regnskapssystemet.',
        icon: Receipt,
        comingSoon: true,
    },
];

const LOCAL_KEY = 'gc_automations_state';
const POLL_MS = 8000;

function loadLocalEnabled(): Record<string, boolean> {
    const base: Record<string, boolean> = {};
    AUTOMATIONS.forEach((a) => {
        base[a.id] = false; // disabled by default
    });
    try {
        const raw = window.localStorage.getItem(LOCAL_KEY);
        if (raw) {
            const saved = JSON.parse(raw) as Record<string, boolean>;
            Object.keys(base).forEach((id) => {
                if (typeof saved[id] === 'boolean') base[id] = saved[id];
            });
        }
    } catch {
        /* ignore */
    }
    return base;
}

function formatElapsed(from: string | null | undefined): string {
    if (!from) return '';
    const secs = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AutomationsWidget() {
    const [enabled, setEnabled] = useState<Record<string, boolean>>(loadLocalEnabled);
    const [dbRows, setDbRows] = useState<AutomationState[]>(() => readCachedAutomations() ?? []);
    const [saving, setSaving] = useState<string | null>(null);
    const [requesting, setRequesting] = useState<string | null>(null);
    const [, setTick] = useState(0); // re-render for the elapsed timer

    // Load the authoritative state from Supabase (falls back to the cache).
    const refresh = useCallback(async (applyEnabled: boolean) => {
        const { rows } = await listAutomations();
        if (!rows.length) return;
        setDbRows(rows);
        if (applyEnabled) {
            setEnabled((prev) => {
                const next = { ...prev };
                rows.forEach((r) => {
                    if (typeof r.enabled === 'boolean') next[r.id] = r.enabled;
                });
                try {
                    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
                } catch {
                    /* ignore */
                }
                return next;
            });
        }
    }, []);

    useEffect(() => {
        refresh(true);
    }, [refresh]);

    // Poll for live run state (queued / running / progress).
    useEffect(() => {
        const t = setInterval(() => refresh(false), POLL_MS);
        return () => clearInterval(t);
    }, [refresh]);

    // Tick the elapsed-time display.
    useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 5000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(LOCAL_KEY, JSON.stringify(enabled));
        } catch {
            /* ignore */
        }
    }, [enabled]);

    const toggle = useCallback(
        async (a: AutomationDef) => {
            if (a.comingSoon) return;
            const next = !enabled[a.id];
            setEnabled((prev) => ({ ...prev, [a.id]: next })); // optimistic
            setSaving(a.id);
            try {
                await setAutomationEnabled(a.id, next);
            } catch {
                /* keep the optimistic local state; Supabase stays authoritative on next load */
            } finally {
                setSaving(null);
            }
        },
        [enabled]
    );

    /** Ask the local scheduler to run this automation right away. */
    const runNow = useCallback(
        async (a: AutomationDef) => {
            if (a.comingSoon) return;
            setRequesting(a.id);
            try {
                await requestAutomationRun(a.id);
                await refresh(false); // pick up the "queued" state immediately
            } catch {
                /* ignore */
            } finally {
                setRequesting(null);
            }
        },
        [refresh]
    );

    const readyCount = useMemo(() => AUTOMATIONS.filter((a) => !a.comingSoon).length, []);
    const activeCount = useMemo(
        () => AUTOMATIONS.filter((a) => !a.comingSoon && enabled[a.id]).length,
        [enabled]
    );

    const rowFor = (id: string) => dbRows.find((r) => r.id === id);

    // The scheduler writes a heartbeat on every poll; if it's stale it isn't running.
    const heartbeat = dbRows
        .map((r) => r.scheduler_heartbeat_at)
        .filter(Boolean)
        .sort()
        .pop() as string | undefined;
    const schedulerOnline = heartbeat
        ? Date.now() - new Date(heartbeat).getTime() < 90_000
        : false;

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
                    <span
                        className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1 ${
                            schedulerOnline ? 'text-green-600' : 'text-red-500'
                        }`}
                        title={
                            schedulerOnline
                                ? 'Scheduleren kjører og plukker opp «Kjør nå»'
                                : 'Scheduleren kjører ikke — start den med `npm run schedule` i dalux-automation'
                        }
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                schedulerOnline ? 'bg-green-500' : 'bg-red-500'
                            }`}
                        />
                        Scheduler {schedulerOnline ? 'online' : 'offline'}
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="space-y-2">
                {AUTOMATIONS.map((a) => {
                    const isActive = !a.comingSoon && enabled[a.id];
                    const Icon = a.icon;
                    const row = rowFor(a.id);
                    const isRunning = row?.run_status === 'running';
                    const isQueued = row?.run_status === 'queued';
                    const busy = isRunning || isQueued;

                    const rowClasses = a.comingSoon
                        ? 'border-dashed border-slate-200 bg-slate-50/50'
                        : busy
                            ? 'border-primary-200 bg-primary-50/60'
                            : isActive
                                ? 'border-green-200 bg-green-50/60'
                                : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70';

                    const iconWrapClasses = a.comingSoon
                        ? 'bg-slate-100 text-slate-400'
                        : busy
                            ? 'bg-primary-100 text-primary-600'
                            : isActive
                                ? 'bg-green-100 text-green-600'
                                : 'bg-white text-slate-400 border border-slate-200';

                    const statusClasses = a.comingSoon
                        ? 'bg-amber-100 text-amber-700'
                        : busy
                            ? 'bg-primary-100 text-primary-700'
                            : isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-200 text-slate-600';

                    const statusLabel = a.comingSoon
                        ? 'Kommer'
                        : busy
                            ? 'Kjører'
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
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
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

                                {/* Live progress */}
                                {busy && (
                                    <p className="text-[10px] font-bold text-primary-700 mt-1 flex items-center gap-1.5">
                                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                        <span className="truncate">
                                            {isQueued
                                                ? schedulerOnline
                                                    ? 'I kø – venter på scheduler'
                                                    : 'I kø – scheduler er ikke startet (kjør `npm run schedule`)'
                                                : `Kjører (${formatElapsed(row?.run_started_at)}): ${
                                                      row?.run_progress || '…'
                                                  }`}
                                        </span>
                                    </p>
                                )}

                                {!busy && a.scheduleLabel && (
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {a.scheduleLabel}
                                    </p>
                                )}
                                {!busy && !a.comingSoon && row?.last_run_at && (
                                    <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                        Sist kjørt:{' '}
                                        {new Date(row.last_run_at).toLocaleString('no-NO', {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        })}
                                        {row.last_run_status ? ` — ${row.last_run_status}` : ''}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {!a.comingSoon && (
                                    <button
                                        type="button"
                                        onClick={() => runNow(a)}
                                        disabled={requesting === a.id || busy}
                                        title="Kjør automasjonen nå (krever at scheduleren kjører)"
                                        className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                                    >
                                        {busy || requesting === a.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Play className="w-3 h-3" />
                                        )}
                                        {busy || requesting === a.id ? 'Kjører…' : 'Kjør nå'}
                                    </button>
                                )}

                                <div className="flex flex-col items-end gap-1.5">
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
                                        disabled={a.comingSoon || saving === a.id}
                                        onClick={() => toggle(a)}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${
                                            a.comingSoon
                                                ? 'bg-slate-200 cursor-not-allowed'
                                                : saving === a.id
                                                    ? 'bg-primary-300 cursor-wait'
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
