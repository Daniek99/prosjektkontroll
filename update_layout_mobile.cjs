const fs = require('fs');

let layoutCode = fs.readFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/Layout.tsx', 'utf8');

if (!layoutCode.includes('import { useState')) {
    layoutCode = "import { useState } from 'react';\n" + layoutCode;
}

if (!layoutCode.includes('Menu,')) {
    layoutCode = layoutCode.replace(
        'import {\n    LayoutDashboard',
        'import {\n    Menu,\n    X,\n    LayoutDashboard'
    );
}

if (!layoutCode.includes('showMobileMenu')) {
    layoutCode = layoutCode.replace(
        'export default function Layout() {',
        'export default function Layout() {\n    const [showMobileMenu, setShowMobileMenu] = useState(false);'
    );
}

const oldHeader = `<header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-primary-500 text-white shadow-sm z-10 transition-all">`;
const newHeader = `<header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-primary-500 text-white shadow-sm z-10 transition-all">
                    <div className="md:hidden flex items-center mr-2">
                        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 -ml-2 text-white/90 hover:text-white">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>`;
layoutCode = layoutCode.replace(oldHeader, newHeader);

const mobileSidebar = `
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
`;

if (!layoutCode.includes('Mobile Sidebar Overlay')) {
    layoutCode = layoutCode.replace('{/* Main Content Area */}', mobileSidebar + '\n            {/* Main Content Area */}');
}

fs.writeFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/Layout.tsx', layoutCode);

// Update GlobalSearch.tsx to accept props
let searchCode = fs.readFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/GlobalSearch.tsx', 'utf8');

searchCode = searchCode.replace(
    'export default function GlobalSearch() {',
    'export default function GlobalSearch({ isMobile, onSearchClose }: { isMobile?: boolean, onSearchClose?: () => void }) {'
);

searchCode = searchCode.replace(
    'className="relative w-full max-w-sm ml-4 hidden md:block"',
    'className={`relative w-full max-w-sm ${isMobile ? "" : "ml-4 hidden md:block"}`}'
);

searchCode = searchCode.replace(
    'const handleResultClick = (path: string) => {',
    'const handleResultClick = (path: string) => {\n        if (onSearchClose) onSearchClose();'
);

// We need to fix the input style if it's on mobile menu (white bg instead of transparent black)
searchCode = searchCode.replace(
    'className="w-full bg-black/10 border border-white/20 text-white placeholder:text-white/60 rounded-xl pl-9 pr-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all text-sm"',
    'className={`w-full ${isMobile ? "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-primary-500/50 focus:border-primary-500 py-3" : "bg-black/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30 focus:border-transparent py-2"} border rounded-xl pl-9 pr-4 font-medium focus:outline-none focus:ring-2 transition-all text-sm`}'
);
searchCode = searchCode.replace(
    '<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />',
    '<Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isMobile ? "text-slate-400" : "text-white/50"}`} />'
);

fs.writeFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/GlobalSearch.tsx', searchCode);
console.log("Layout and Search Mobile updated");
