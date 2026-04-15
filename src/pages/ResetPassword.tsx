import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, Lock, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    // Make sure we have an active session before allowing password reset
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If the user arrives here without a session (e.g. without clicking a recovery link)
                // they shouldn't be here. Note: Supabase automatically logs the user in if they clicked a valid recovery link.
                navigate('/login');
            }
        };
        checkSession();
    }, [navigate]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
            setTimeout(() => {
                navigate('/');
            }, 3000);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <div className="bg-primary-600 p-4 rounded-2xl shadow-lg shadow-primary-500/30 ring-4 ring-primary-50">
                        <Building2 className="w-12 h-12 text-white" />
                    </div>
                </div>
                <h2 className="mt-8 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
                    Opprett nytt passord
                </h2>
                <p className="mt-2 text-center text-sm font-medium text-slate-500">
                    Skriv inn ditt nye passord for å sikre kontoen
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100">
                    {success ? (
                        <div className="bg-green-50 text-green-700 p-6 rounded-2xl text-center border border-green-100">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h3 className="text-xl font-bold mb-2">Passord oppdatert!</h3>
                            <p className="text-sm">
                                Ditt passord har blitt endret. Videresender deg til oversikten...
                            </p>
                        </div>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetPassword}>
                            {error && (
                                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Nytt passord
                                </label>
                                <div className="mt-1 relative rounded-xl shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white sm:text-sm font-medium transition-all text-slate-900 placeholder:text-slate-400"
                                        placeholder="Min. 6 tegn"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading || password.length < 6}
                                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {loading ? 'Oppdaterer...' : 'Oppdater passord'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
