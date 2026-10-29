import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserProfile = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: 'master' | 'user';
    // Personal "Notater" access. This belongs to the user profile rather than
    // to a specific project, so it follows the user across all projects.
    notes_access: boolean;
};

type AuthContextType = {
    session: Session | null;
    user: User | null;
    profile: UserProfile | null;
    isMaster: boolean;
    profileLoading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async (currentUser: User | null) => {
        if (!currentUser) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }
        setProfileLoading(true);
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, email, full_name, role, notes_access')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('Error fetching profile', error);
        }
        setProfile((data as UserProfile) ?? null);
        setProfileLoading(false);
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) console.error("Error fetching session", error);
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            loadProfile(session?.user ?? null);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            loadProfile(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [loadProfile]);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
    };

    const refreshProfile = async () => {
        await loadProfile(user);
    };

    return (
        <AuthContext.Provider value={{
            session,
            user,
            profile,
            isMaster: profile?.role === 'master',
            profileLoading,
            signOut,
            refreshProfile,
            loading,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
