import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, BookOpen, Flag, Contact, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SearchResult {
    id: string;
    type: 'decision' | 'diary' | 'contact';
    title: string;
    description: string;
    path: string;
}

export default function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchDatabase = async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            setIsOpen(true);
            const searchPattern = `%${query}%`;
            
            const [decisionsRes, diaryRes, contactsRes] = await Promise.all([
                supabase
                    .from('decision_logs')
                    .select('id, subject, content')
                    .or(`subject.ilike.${searchPattern},content.ilike.${searchPattern}`)
                    .limit(5),
                supabase
                    .from('diary_entries')
                    .select('id, content')
                    .ilike('content', searchPattern)
                    .limit(5),
                supabase
                    .from('contacts')
                    .select('id, name, email')
                    .or(`name.ilike.${searchPattern},email.ilike.${searchPattern}`)
                    .limit(5)
            ]);

            const newResults: SearchResult[] = [];

            if (decisionsRes.data) {
                decisionsRes.data.forEach(d => {
                    newResults.push({
                        id: d.id,
                        type: 'decision',
                        title: d.subject,
                        description: d.content?.substring(0, 60) + '...',
                        path: '/decisions'
                    });
                });
            }

            if (diaryRes.data) {
                diaryRes.data.forEach(d => {
                    newResults.push({
                        id: d.id,
                        type: 'diary',
                        title: 'Dagboknotat',
                        description: d.content?.substring(0, 60) + '...',
                        path: '/diary'
                    });
                });
            }

            if (contactsRes.data) {
                contactsRes.data.forEach(c => {
                    newResults.push({
                        id: c.id,
                        type: 'contact',
                        title: c.name,
                        description: c.email,
                        path: '/contacts'
                    });
                });
            }

            setResults(newResults);
            setLoading(false);
        };

        const debounceTimer = setTimeout(searchDatabase, 400);
        return () => clearTimeout(debounceTimer);
    }, [query]);

    const handleResultClick = (path: string) => {
        setIsOpen(false);
        setQuery('');
        navigate(path);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'decision': return <Flag className="w-4 h-4 text-primary-500" />;
            case 'diary': return <BookOpen className="w-4 h-4 text-emerald-500" />;
            case 'contact': return <Contact className="w-4 h-4 text-amber-500" />;
            default: return <FileText className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-sm ml-4 hidden md:block">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (query.trim().length >= 2) setIsOpen(true); }}
                    placeholder="Søk globalt..."
                    className="w-full bg-black/10 border border-white/20 text-white placeholder:text-white/60 rounded-xl pl-9 pr-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all text-sm"
                />
            </div>

            {isOpen && (query.trim().length >= 2) && (
                <div className="absolute top-full mt-2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 text-slate-900">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Søkeresultater</span>
                        {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                        {!loading && results.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 font-medium">
                                Ingen resultater funnet for "{query}"
                            </div>
                        ) : (
                            <ul className="py-2">
                                {results.map((result, idx) => (
                                    <li key={`${result.id}-${idx}`}>
                                        <button 
                                            onClick={() => handleResultClick(result.path)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3"
                                        >
                                            <div className="mt-0.5 bg-slate-100 p-1.5 rounded-lg">
                                                {getIcon(result.type)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm mb-0.5">{result.title}</div>
                                                <div className="text-xs font-medium text-slate-500">{result.description}</div>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
