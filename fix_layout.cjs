const fs = require('fs');
let code = fs.readFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/Layout.tsx', 'utf8');

if (!code.includes('Menu,')) {
    code = code.replace(
        'LayoutDashboard,\r\n    Settings',
        'Menu,\r\n    X,\r\n    LayoutDashboard,\r\n    Settings'
    );
    // If that didn't work (LF line endings)
    code = code.replace(
        'LayoutDashboard,\n    Settings',
        'Menu,\n    X,\n    LayoutDashboard,\n    Settings'
    );
}

fs.writeFileSync('c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/components/Layout.tsx', code);
console.log('Fixed imports');
