import { createClient } from '@supabase/supabase-js'

// Fallback values are baked in so the production build works on Heroku without
// requiring the environment variables to be set via `heroku config:set`.
// In production, prefer setting these via `heroku config:set VITE_SUPABASE_URL=...`
// (the value is injected at build time, since Vite inlines import.meta.env).
const FALLBACK_SUPABASE_URL = 'https://umpomvvazyybuhtlocqb.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcG9tdnZhenl5YnVodGxvY3FiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzA0NTMsImV4cCI6MjA4ODAwNjQ1M30.idAZ7UkkXLND7jFe-sTSNavdjGWHQu6KJPr388KfhY4'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storageKey: 'gc-app-auth',
        storage: window.localStorage
    }
})
