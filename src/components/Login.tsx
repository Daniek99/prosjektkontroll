import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, Lock, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const navigate = useNavigate();
    const { session } = useAuth();

    useEffect(() => {
        if (session) {
            navigate('/', { replace: true });
        }
    }, [session, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Check credentials against Supabase Auth
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        }
        setLoading(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            setError(error.message);
        } else {
            setResetEmailSent(true);
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
                    Prosjektkontroll
                </h2>
                <p className="mt-2 text-center text-sm font-medium text-slate-500">
                    Internt styringspanel
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
                <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-semibold border border-red-100 flex items-center gap-3">
                                <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                E-postadresse
                            </label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white sm:text-sm font-medium transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="name@company.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Passord
                            </label>
                            <div className="mt-1 relative rounded-xl shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white sm:text-sm font-medium transition-all text-slate-900 placeholder:text-slate-400"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotPassword(true);
                                    setError('');
                                    setResetEmailSent(false);
                                }}
                                className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
                            >
                                Glemt passord?
                            </button>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                            >
                                {loading ? 'Logger inn...' : 'Logg inn'}
                            </button>
                        </div>
                    </form>

                    {/* Forgot Password Form */}
                    {showForgotPassword && (
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            {resetEmailSent ? (
                                <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm font-semibold border border-green-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                                        E-post sendt!
                                    </div>
                                    <p className="text-green-600">
                                        Sjekk innboksen din for å motta en lenke for å tilbakestille passordet.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForgotPassword(false);
                                            setResetEmailSent(false);
                                        }}
                                        className="mt-4 w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all"
                                    >
                                        Tilbake til innlogging
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleForgotPassword} className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForgotPassword(false);
                                                setError('');
                                            }}
                                            className="flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            <ArrowLeft className="w-4 h-4 mr-1" />
                                            Tilbake
                                        </button>
                                        <h3 className="text-sm font-bold text-slate-700">Tilbakestill passord</h3>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Skriv inn e-postadressen din så sender vi deg en lenke for å tilbakestille passordet.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={loading || !email}
                                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                                    >
                                        {loading ? 'Sender...' : 'Send lenke'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
