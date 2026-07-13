const fs = require('fs');
let c = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 1. Remove unused imports and add ChevronDown if not present
// (ChevronDown and Filter are already imported)

// 2. Remove old multi-select state variables
c = c.replace(
    /const \[selectedSubcontractorIds, setSelectedSubcontractorIds\] = useState<Set<string>>\(new Set\(\)\);\n    const \[showSubcontractorDropdown, setShowSubcontractorDropdown\] = useState\(false\);\n    const dropdownRef = useRef<HTMLDivElement>\(null\);\n    const \[showAllAlerts, setShowAllAlerts\] = useState\(false\);/,
    'const [showAllAlerts, setShowAllAlerts] = useState(false);'
);

// 3. Remove dropdown click-outside useEffect
c = c.replace(
    /\n    \/\/ Close dropdown on click outside\n    useEffect\(\(\) => \{\n        function handleClickOutside\(e: MouseEvent\) \{\n            if \(dropdownRef\.current && !dropdownRef\.current\.contains\(e\.target as Node\)\) \{\n                setShowSubcontractorDropdown\(false\);\n            \}\n        \}\n        document\.addEventListener\('mousedown', handleClickOutside\);\n        return \(\) => document\.removeEventListener\('mousedown', handleClickOutside\);\n    \}, \[\]\);\n/,
    '\n'
);

// 4. Remove toggleSubcontractor and selectAllSubcontractors functions
c = c.replace(
    /\n    const toggleSubcontractor = \(id: string\) => \{\n        setSelectedSubcontractorIds\(prev => \{\n            const next = new Set\(prev\);\n            if \(next\.has\(id\)\) \{\n                next\.delete\(id\);\n            \} else \{\n                next\.add\(id\);\n            \}\n            return next;\n        \}\);\n    \};\n\n    const selectAllSubcontractors = \(\) => \{\n        setSelectedSubcontractorIds\(new Set\(\)\);\n    \};\n/,
    '\n'
);

// 5. Update filteredAlerts to remove subcontractor filter
c = c.replace(
    /const hasSubcontractorFilter = selectedSubcontractorIds\.size > 0;\n    const filteredAlerts = progressAlerts\.filter\(a => \{\n        if \(hasSubcontractorFilter && !selectedSubcontractorIds\.has\(a\.subcontractor_id\)\) return false;\n        if \(!showStarts && a\.type === 'start'\) return false;/,
    'const filteredAlerts = progressAlerts.filter(a => {\n        if (!showStarts && a.type === \'start\') return false;'
);

// 6. Update in-progress activities filter to remove subcontractor filter
c = c.replace(
    /\.filter\(a => !hasSubcontractorFilter \|\| selectedSubcontractorIds\.has\(a\.subcontractor_id\)\)/,
    ''
);

fs.writeFileSync('src/pages/Dashboard.tsx', c);
console.log('Cleaned up Dashboard.tsx');