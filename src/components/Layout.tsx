import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Menu, X, LayoutDashboard,
    Settings,
    Users,
    Activity,
    ShieldAlert,
    ClipboardList,
    LogOut,
    FileSpreadsheet,
    BookOpen,
    Building2,
    Map,
    Contact,
    BarChart3,
    Flag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SubcontractorSelector from './SubcontractorSelector';
import GlobalSearch from './GlobalSearch';
import { cn } from '../lib/utils';

const navItems = [
    { name: 'Oversikt', icon: LayoutDashboard, path: '/' },
    { name: 'Prosjektoppsett', icon: Settings, path: '/setup' },
    { name: 'Underentreprenører', icon: Users, path: '/subcontractors' },
    { name: 'Kontraktdetaljer', icon: FileSpreadsheet, path: '/contracts' },
    { name: 'Fremdrift', icon: Activity, path: '/progress' },
    { name: 'Økonomi', icon: Activity, path: '/financials' },
    { name: 'Risikostyring', icon: ShieldAlert, path: '/risks' },
    { name: 'Bemanning', icon: ClipboardList, path: '/bemanning' },
    { name: 'Områder', icon: Map, path: '/areas' },
    { name: 'Dagbok', icon: BookOpen, path: '/diary' },
    { name: 'Beslutninger', icon: Flag, path: '/decisions' },
    { name: 'Kontakter', icon: Contact, path: '/contacts' },
    { name: 'Statistikk', icon: BarChart3, path: '/statistics' },
];

export default function Layout() {
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const { signOut, user } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 z-20 flex-shrink-0 relative">
                <div className="h-16 flex items-center px-6 border-b border-slate-200">
                    <div className="p-1 rounded-lg mr-3 flex-shrink-0">
                        <Building2 className="w-8 h-8 text-primary-500" />
                    </div>
                    <span className="text-xl font-bold text-slate-800 tracking-tight leading-none">Prosjektkontroll</span>
                </div>

                <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                                isActive
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <item.icon className={cn(
                                "w-5 h-5 mr-3 flex-shrink-0 transition-colors",
                                // Active state handled by parent text color effectively, but standardizing
                            )} />
                            {item.name}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <div className="mb-2 px-3 py-2">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Logget inn som</div>
                        <div className="text-sm font-medium text-slate-800 truncate" title={user?.email}>
                            {user?.email}
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-200 hover:text-slate-900 transition-colors"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        Logg ut
                    </button>
                </div>
            </aside>

            
            {/* Mobile Sidebar Overlay */}
            {showMobileMenu && (
                <div className="md:hidden fixed inset-0 z-50 flex">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
                    <aside className="relative w-80 max-w-[85%] bg-white h-full flex flex-col animate-in slide-in-from-left-full duration-300 shadow-2xl">
                        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-100 bg-primary-500 text-white">
                            <div className="flex items-center">
                                <Building2 className="w-6 h-6 mr-2" />
                                <span className="font-bold text-lg">Meny</span>
                            </div>
                            <button onClick={() => setShowMobileMenu(false)} className="p-2 text-white/80 hover:text-white bg-white/10 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="px-4 py-4 bg-slate-50 border-b border-slate-200">
                            <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">Globalt Søk</div>
                            <GlobalSearch isMobile={true} onSearchClose={() => setShowMobileMenu(false)} />
                        </div>
                        
                        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 bg-white">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setShowMobileMenu(false)}
                                    className={({ isActive }) => cn(
                                        "flex items-center px-4 py-3.5 font-bold rounded-xl transition-all",
                                        isActive
                                            ? "bg-primary-50 text-primary-700 border border-primary-100"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className={cn("w-5 h-5 mr-3 text-inherit")} />
                                    {item.name}
                                </NavLink>
                            ))}
                        </nav>
                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => { setShowMobileMenu(false); handleSignOut(); }}
                                className="flex items-center justify-center w-full px-4 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                                <LogOut className="w-5 h-5 mr-2" />
                                Logg ut
                            </button>
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Top Header */}
                <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-primary-500 text-white shadow-sm z-10 transition-all">
                    <div className="md:hidden flex items-center mr-2">
                        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 -ml-2 text-white/90 hover:text-white">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="md:hidden flex items-center">
                        <div className="bg-white/20 p-1.5 rounded-lg mr-2">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Prosjektkontroll</span>
                    </div>

                    <div className="flex-1 flex justify-end md:justify-between items-center ml-4">
                        <GlobalSearch />
                        <div className="hidden md:flex items-center space-x-2 text-sm font-medium text-white/90">
                            <SubcontractorSelector />
                        </div>
                        <div className="md:hidden flex items-center space-x-4">
                            <SubcontractorSelector />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto bg-slate-100 relative pb-24 md:pb-8">
                    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
                <div className="flex justify-around items-center h-16 sm:h-20 px-1">
                    {navItems.slice(0, 5).map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative group",
                                isActive ? "text-primary-600" : "text-slate-400 hover:text-slate-900"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <span className="absolute top-0 w-8 h-1 bg-primary-600 rounded-b-full shadow-sm shadow-primary-500/50" />
                                    )}
                                    <item.icon className={cn("w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200", isActive && "scale-110")} />
                                    <span className="text-[10px] sm:text-xs font-bold tracking-wide">{item.name}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
