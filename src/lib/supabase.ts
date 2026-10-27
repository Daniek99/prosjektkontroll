import { createClient } from '@supabase/supabase-js'

// Fallback values are baked in so the production build works on Heroku without
// requiring the environment variables to be set via `heroku config:set`.
// In production, prefer setting these via `heroku config:set VITE_SUPABASE_URL=...`
// (the value is injected at build time, since Vite inlines import.meta.env).
const FALLBACK_SUPABASE_URL = 'https://umpomvvazyybuhtlocqb.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcG9tdnZhenl5YnVodGxvY3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzA0NTMsImV4cCI6MjA4ODAwNjQ1M30.idAZ7UkkXLND7jFe-sTSNavdjGWHQu6KJPr388KfhY4'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Project scoping
// ---------------------------------------------------------------------------
// The database uses Row Level Security that reads the currently selected
// project from the `x-project-id` request header. Keeping the value in a
// module-level variable lets us inject it into every request (including
// storage uploads) without touching any of the existing queries.
let currentProjectId: string | null = null

export function setCurrentProjectId(id: string | null) {
    currentProjectId = id
}

export function getCurrentProjectId() {
    return currentProjectId
}

const projectAwareFetch: typeof fetch = (input, init) => {
    // Preserve headers supplied through either a Request object or fetch init.
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    if (currentProjectId) {
        headers.set('x-project-id', currentProjectId)
    }
    return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: projectAwareFetch,
    },
    auth: {
        persistSession: true,
        storageKey: 'gc-app-auth',
        storage: window.localStorage
    }
})
