import { supabase } from './supabase';

/**
 * Automations registry — shared between the web app and the local Playwright
 * scheduler (dalux-automation). The `enabled` flag lives in Supabase so the
 * scheduler (which runs outside the browser) can read it.
 *
 * A localStorage cache mirrors the state so the widget still renders if
 * Supabase is briefly unavailable.
 */

export interface AutomationState {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    /** cron expression, e.g. '0 14 * * 3' = every Wednesday 14:00 */
    schedule: string;
    last_run_at: string | null;
    last_run_status: string | null;
    run_requested_at: string | null;
    /** queued | running | done | failed */
    run_status: string | null;
    run_started_at: string | null;
    run_finished_at: string | null;
    /** latest progress line from the running script */
    run_progress: string | null;
    /** last time the local scheduler checked in (drives the online indicator) */
    scheduler_heartbeat_at: string | null;
    stop_requested_at: string | null;
    updated_at: string;
}

const CACHE_KEY = 'gc_automations_cache';

export function readCachedAutomations(): AutomationState[] | null {
    try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as AutomationState[]) : null;
    } catch {
        return null;
    }
}

function writeCache(rows: AutomationState[]) {
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
    } catch {
        /* ignore */
    }
}

/** Load all automations. Falls back to the local cache on failure. */
export async function listAutomations(): Promise<{ rows: AutomationState[]; fromCache: boolean }> {
    const { data, error } = await supabase.from('automations').select('*').order('name');
    if (error || !data) {
        return { rows: readCachedAutomations() ?? [], fromCache: true };
    }
    writeCache(data as AutomationState[]);
    return { rows: data as AutomationState[], fromCache: false };
}

/** Persist the on/off flag for one automation. */
export async function setAutomationEnabled(id: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
        .from('automations')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;

    const cached = readCachedAutomations();
    if (cached) {
        writeCache(cached.map((r) => (r.id === id ? { ...r, enabled } : r)));
    }
}

/**
 * Ask the local scheduler to run this automation immediately, bypassing the
 * cron schedule. The scheduler polls for `run_requested_at`, clears it and
 * executes the script.
 */
export async function requestAutomationRun(id: string): Promise<void> {
    const { error } = await supabase
        .from('automations')
        .update({
            run_requested_at: new Date().toISOString(),
            run_status: 'queued',
            run_progress: 'I kø – venter på scheduler',
        })
        .eq('id', id);
    if (error) throw error;
}

/** Ask the local scheduler to stop the run that is currently in progress. */
export async function requestAutomationStop(id: string): Promise<void> {
    const { error } = await supabase
        .from('automations')
        .update({ stop_requested_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}
