const fs = require('fs');
const path = 'c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/pages/Bemanning.tsx';
let code = fs.readFileSync(path, 'utf8');

// The typescript compiler complained about unused 'defaultHours' and 'dayOfWeek'. Let's remove them where they are unused.

code = code.replace(
    'const dayOfWeek = now.getDay();\n        const defaultHours = (dayOfWeek >= 1 && dayOfWeek <= 4) ? 8 : (dayOfWeek === 5) ? 5.5 : 0;\n        setNewManpower',
    'setNewManpower'
);

code = code.replace(
    'const dayOfWeek = new Date(dateStr).getDay();\n                                                    const defaultHours = (dayOfWeek >= 1 && dayOfWeek <= 4) ? 8 : (dayOfWeek === 5) ? 5.5 : 0;\n                                                    setNewManpower({',
    'setNewManpower({'
);

code = code.replace(
    'const dayOfWeek = new Date(dateStr).getDay();\n                                                    const defaultHours = (dayOfWeek >= 1 && dayOfWeek <= 4) ? 8 : (dayOfWeek === 5) ? 5.5 : 0;\n                                                    setNewManpower({',
    'setNewManpower({'
);

code = code.replace(
    'const newDate = e.target.value;\n                                        const defaultHours = Number(newManpower.billable_workers) > 0 ? getDefaultHours(newDate, Number(newManpower.billable_workers)) : 0;\n                                        setNewManpower({ ...newManpower, date: newDate /* hours_billable removed */ });',
    'const newDate = e.target.value;\n                                        setNewManpower({ ...newManpower, date: newDate });'
);

code = code.replace(
    'onChange={(e) => {\n                                                const workers = Math.max(0, (Number(newManpower.billable_workers) || 0) - 1);\n                                                const defaultHours = workers ? getDefaultHours(newManpower.date, workers) : 0;\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}',
    'onChange={(e) => {\n                                                const workers = Math.max(0, (Number(newManpower.billable_workers) || 0) - 1);\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}'
);

code = code.replace(
    'onChange={(e) => {\n                                                const workers = e.target.value === \'\' ? \'\' : Number(e.target.value);\n                                                const defaultHours = workers ? getDefaultHours(newManpower.date, Number(workers)) : 0;\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}',
    'onChange={(e) => {\n                                                const workers = e.target.value === \'\' ? \'\' : Number(e.target.value);\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}'
);

code = code.replace(
    'onChange={(e) => {\n                                                const workers = (Number(newManpower.billable_workers) || 0) + 1;\n                                                const defaultHours = workers ? getDefaultHours(newManpower.date, workers) : 0;\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}',
    'onChange={(e) => {\n                                                const workers = (Number(newManpower.billable_workers) || 0) + 1;\n                                                setNewManpower({ ...newManpower, billable_workers: workers });\n                                            }}'
);

fs.writeFileSync(path, code);
console.log("Cleanup done!");
