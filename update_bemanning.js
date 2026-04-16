const fs = require('fs');
const path = 'c:/Users/NO-daek/.gemini/antigravity/playground/pyro-planetary/gc-app/src/pages/Bemanning.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. State definition
code = code.replace(
    'activity_id: string | null;\n        hours_billable: number | string;',
    'billable_activities: Array<{ activity_id: string, hours: string | number }>;'
);
code = code.replace(
    "activity_id: null,\n        hours_billable: '',",
    'billable_activities: [],'
);

// 2. resetForm
code = code.replace(
    "activity_id: null,\n            hours_billable: defaultHours,",
    'billable_activities: [],'
);
code = code.replace(
    "const defaultHours = (dayOfWeek >= 1 && dayOfWeek <= 4) ? 8 : (dayOfWeek === 5) ? 5.5 : 0;",
    "" // We still need dayOfWeek?
);

// 3. handleAddActivity
code = code.replace(
    "setNewManpower({ ...newManpower, activity_id: data[0].id });",
    "setNewManpower({ ...newManpower, billable_activities: [...newManpower.billable_activities, { activity_id: data[0].id, hours: '' }] });"
);

// 4. handleAddManpower
code = code.replace(
    "activity_id: newManpower.activity_id || null,\n            hours_contract: 0,\n            hours_billable: Number(newManpower.hours_billable) || 0",
    "activity_id: newManpower.billable_activities.length === 1 ? newManpower.billable_activities[0].activity_id : null,\n            hours_contract: 0,\n            hours_billable: newManpower.billable_activities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0),\n            billable_activities: newManpower.billable_activities"
);

// 5. Calendar selections
code = code.replace(
    "activity_id: log.activity_id || null,\n                                                        hours_billable: log.hours_billable ?? '',",
    "billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),"
);
code = code.replace(
    "activity_id: null,\n                                                        hours_billable: defaultHours,",
    "billable_activities: [],"
);

code = code.replace(
    "activity_id: log.activity_id || null,\n                                                        hours_billable: log.hours_billable ?? '',",
    "billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),"
);
code = code.replace(
    "activity_id: null,\n                                                        hours_billable: defaultHours,",
    "billable_activities: [],"
);

code = code.replace(
    "activity_id: log.activity_id || null,\n                                                hours_billable: log.hours_billable ?? '',",
    "billable_activities: log.billable_activities || (log.activity_id ? [{ activity_id: log.activity_id, hours: log.hours_billable }] : []),"
);

// 6. Fix set hours_billable in the date change and workers count change
code = code.replace(
    "hours_billable: defaultHours || newManpower.hours_billable",
    "/* hours_billable removed */"
);

code = code.replace(
    "setNewManpower({ ...newManpower, billable_workers: workers, hours_billable: defaultHours });",
    "setNewManpower({ ...newManpower, billable_workers: workers });"
);
code = code.replace(
    "setNewManpower({ ...newManpower, billable_workers: workers, hours_billable: defaultHours });",
    "setNewManpower({ ...newManpower, billable_workers: workers });"
);
code = code.replace(
    "setNewManpower({ ...newManpower, billable_workers: workers, hours_billable: defaultHours });",
    "setNewManpower({ ...newManpower, billable_workers: workers });"
);
code = code.replace(
    "setNewManpower({ ...newManpower, billable_workers: workers, hours_billable: defaultHours });",
    "setNewManpower({ ...newManpower, billable_workers: workers });"
);

// 7. Update UI for Recent Logs List to show multiple activities
const oldRecentLogsBlock = `                                        {(log.hours_billable > 0) && (
                                            <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                                                <div className="flex items-center">
                                                    <Clock className="w-3 h-3 mr-1 text-amber-500" />
                                                    <span className="font-bold mr-1">{log.hours_billable || 0}</span> regningstimer
                                                </div>
                                            </div>
                                        )}
                                        {activity?.change_order_number && (
                                            <div className="text-sm text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-2">
                                                <span className="font-bold block mb-0.5 text-xs text-blue-800">Endringsmelding:</span>
                                                {activity.change_order_number}
                                            </div>
                                        )}`;

const newRecentLogsBlock = `                                        {(log.billable_activities && log.billable_activities.length > 0) ? (
                                            <div className="mb-2 space-y-1">
                                                {log.billable_activities.map((act: any, i: number) => {
                                                    const actDetails = activities.find(a => a.id === act.activity_id);
                                                    return (
                                                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                                            <Clock className="w-3 h-3 text-amber-500" />
                                                            <span className="font-bold text-amber-700">{act.hours}t</span>
                                                            {actDetails ? (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-50 text-primary-700 border border-primary-100">
                                                                    {actDetails.name} {actDetails.change_order_number ? \`(\${actDetails.change_order_number})\` : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-600">
                                                                    Ukjent aktivitet
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            log.hours_billable > 0 && (
                                                <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                                                    <div className="flex items-center">
                                                        <Clock className="w-3 h-3 mr-1 text-amber-500" />
                                                        <span className="font-bold mr-1">{log.hours_billable || 0}</span> regningstimer
                                                    </div>
                                                    {log.activity_id && activities.find(a => a.id === log.activity_id) && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-50 text-primary-700">
                                                            {activities.find(a => a.id === log.activity_id)?.name}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        )}`;

code = code.replace(oldRecentLogsBlock, newRecentLogsBlock);


// 8. Update UI for editing activities entirely
const oldActivitySelectionSection = `{/* Activity Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-bold text-slate-700">Aktivitet (for regningsarbeid)</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickAddActivity(!showQuickAddActivity)}
                                        className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center"
                                    >
                                        <Plus className="w-3 h-3 mr-1" />
                                        Ny aktivitet
                                    </button>
                                </div>
                                
                                {showQuickAddActivity ? (
                                    <div className="bg-primary-50 p-4 rounded-xl border border-primary-200 space-y-3">
                                        <input
                                            type="text"
                                            value={newActivityName}
                                            onChange={(e) => setNewActivityName(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                            placeholder="Navn på aktivitet *"
                                        />
                                        <input
                                            type="text"
                                            value={newActivityDesc}
                                            onChange={(e) => setNewActivityDesc(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                            placeholder="Beskrivelse (valgfritt)"
                                        />
                                        <input
                                            type="text"
                                            value={newActivityChangeOrder}
                                            onChange={(e) => setNewActivityChangeOrder(e.target.value)}
                                            className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            placeholder="Endringsmelding nummer (f.eks. EM-001)"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleAddActivity}
                                                disabled={!newActivityName.trim()}
                                                className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                                            >
                                                Opprett aktivitet
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowQuickAddActivity(false);
                                                    setNewActivityName('');
                                                    setNewActivityDesc('');
                                                    setNewActivityChangeOrder('');
                                                }}
                                                className="px-3 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                            >
                                                Avbryt
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <select
                                            value={newManpower.activity_id || ''}
                                            onChange={(e) => setNewManpower({ ...newManpower, activity_id: e.target.value || null })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-base"
                                        >
                                            <option value="">Velg aktivitet...</option>
                                            {activities.map(activity => (
                                                <option key={activity.id} value={activity.id}>
                                                    {activity.name}{activity.change_order_number ? \` (\${activity.change_order_number})\` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {newManpower.activity_id && activities.find(a => a.id === newManpower.activity_id)?.change_order_number && (
                                            <div className="mt-2 text-sm text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-100">
                                                <span className="font-bold">Endringsmelding:</span> {activities.find(a => a.id === newManpower.activity_id)?.change_order_number}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>`;

const newActivitySelectionSection = `{/* Activities and Hours Section */}
                            {Number(newManpower.billable_workers) > 0 && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">Aktiviteter for regningsarbeid</label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowQuickAddActivity(!showQuickAddActivity)}
                                                className="text-xs text-primary-600 hover:text-primary-700 font-bold flex items-center p-1"
                                            >
                                                <Plus className="w-4 h-4 mr-1" />
                                                Ny aktivitet
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {showQuickAddActivity && (
                                        <div className="bg-primary-50 p-4 rounded-xl border border-primary-200 space-y-3">
                                            <input
                                                type="text"
                                                value={newActivityName}
                                                onChange={(e) => setNewActivityName(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                placeholder="Navn på aktivitet *"
                                            />
                                            <input
                                                type="text"
                                                value={newActivityDesc}
                                                onChange={(e) => setNewActivityDesc(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                                                placeholder="Beskrivelse (valgfritt)"
                                            />
                                            <input
                                                type="text"
                                                value={newActivityChangeOrder}
                                                onChange={(e) => setNewActivityChangeOrder(e.target.value)}
                                                className="w-full bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                placeholder="Endringsmelding nummer (f.eks. EM-001)"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAddActivity}
                                                    disabled={!newActivityName.trim()}
                                                    className="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                                                >
                                                    Opprett aktivitet
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowQuickAddActivity(false);
                                                        setNewActivityName('');
                                                        setNewActivityDesc('');
                                                        setNewActivityChangeOrder('');
                                                    }}
                                                    className="px-3 py-2 bg-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-300 transition-colors"
                                                >
                                                    Avbryt
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        {newManpower.billable_activities.map((act, index) => (
                                            <div key={index} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-200 relative">
                                                <div className="flex-1">
                                                    <select
                                                        value={act.activity_id}
                                                        onChange={(e) => {
                                                            const newActivities = [...newManpower.billable_activities];
                                                            newActivities[index].activity_id = e.target.value;
                                                            setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                        }}
                                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all text-sm sm:text-base"
                                                    >
                                                        <option value="">Velg aktivitet...</option>
                                                        {activities.map(activity => (
                                                            <option key={activity.id} value={activity.id}>
                                                                {activity.name}{activity.change_order_number ? \` (\${activity.change_order_number})\` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-24">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.5"
                                                            value={act.hours}
                                                            onChange={(e) => {
                                                                const newActivities = [...newManpower.billable_activities];
                                                                newActivities[index].hours = e.target.value === '' ? '' : Number(e.target.value);
                                                                setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                            }}
                                                            className="w-full bg-white border border-amber-300 rounded-lg px-2 py-2.5 font-extrabold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 pr-6 text-center text-sm sm:text-base"
                                                            placeholder="0"
                                                        />
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-sm pointer-events-none">t</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newActivities = newManpower.billable_activities.filter((_, i) => i !== index);
                                                        setNewManpower({ ...newManpower, billable_activities: newActivities });
                                                    }}
                                                    className="p-2.5 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-lg ml-1"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const totalHoursSoFar = newManpower.billable_activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
                                                const defaultHours = getDefaultHours(newManpower.date, Number(newManpower.billable_workers) || 0);
                                                const remainingHours = Math.max(0, defaultHours - totalHoursSoFar);
                                                setNewManpower({ 
                                                    ...newManpower, 
                                                    billable_activities: [...newManpower.billable_activities, { activity_id: '', hours: remainingHours || '' }] 
                                                });
                                            }}
                                            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:text-primary-600 hover:border-primary-300 transition-colors flex items-center justify-center text-sm bg-white"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Legg til ny regningsaktivitet
                                        </button>
                                        <p className="text-xs text-slate-500 mt-2 text-center uppercase tracking-widest font-bold">
                                            Forventet: {getDefaultHours(newManpower.date, Number(newManpower.billable_workers) || 0)}t | Totalt utfylt: {newManpower.billable_activities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0)}t
                                        </p>
                                    </div>
                                </div>
                            )}`;

const hoursSection = `                             <div>
                                 <label className="block text-sm font-bold text-slate-700 mb-1">Regningstimer</label>
                                 <input
                                     type="number"
                                     min="0"
                                     step="0.5"
                                     value={newManpower.hours_billable}
                                     onChange={(e) => setNewManpower({ ...newManpower, hours_billable: e.target.value === '' ? '' : Number(e.target.value) })}
                                     className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-base"
                                     placeholder="0"
                                 />
                                 {Number(newManpower.billable_workers) > 0 && (
                                     <p className="text-xs text-slate-500 mt-1">
                                         Standard: {getDefaultHours(newManpower.date, Number(newManpower.billable_workers) || 0)}t 
                                         ({new Date(newManpower.date).getDay() === 5 ? 'Fredag: 5.5t per arbeider' : 'Mandag-Torsdag: 8t per arbeider'})
                                     </p>
                                 )}
                             </div>`;

code = code.replace(oldActivitySelectionSection, newActivitySelectionSection);
code = code.replace(hoursSection, ''); // remove the static hours section entirely

// 9. Fix comment required logic 
code = code.replace(
    'Kommentar for regningsarbeid {!newManpower.activity_id && <span className="text-red-500">*</span>}',
    'Kommentar for regningsarbeid {newManpower.billable_activities.length === 0 && <span className="text-red-500">*</span>}'
);
code = code.replace(
    'required={Number(newManpower.billable_workers) > 0 && !newManpower.activity_id}',
    'required={Number(newManpower.billable_workers) > 0 && newManpower.billable_activities.length === 0}'
);
code = code.replace(
    'placeholder={newManpower.activity_id ? "Valgfri kommentar (aktivitet er valgt)" : "Gjelder regningsarbeid for... (Kreves når arbeidere er registrert på regning uten aktivitet)"}',
    'placeholder={newManpower.billable_activities.length > 0 ? "Valgfri kommentar (aktiviteter er valgt)" : "Gjelder regningsarbeid for... (Kreves når arbeidere er registrert på regning uten aktivitet)"}'
);
code = code.replace(
    '{newManpower.activity_id && (\n                                            <p className="text-xs text-slate-500 mt-1">Kommentar er valgfri når aktivitet er valgt.</p>\n                                        )}',
    '{newManpower.billable_activities.length > 0 && (\n                                            <p className="text-xs text-slate-500 mt-1">Kommentar er valgfri når aktiviteter er valgt.</p>\n                                        )}'
);

// 10. Summary total hours
code = code.replace(
    '<span className="text-xl font-extrabold text-amber-600">{Number(newManpower.hours_billable) || 0}</span>',
    '<span className="text-xl font-extrabold text-amber-600">{newManpower.billable_activities.reduce((sum, act) => sum + (Number(act.hours) || 0), 0)}</span>'
);

// 11. Activity tag in Recent Logs List (removes the blue tag that could be duplicated)
code = code.replace(
    `                                            {activity && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700">
                                                    {activity.name}
                                                </span>
                                            )}`,
                                            `                                            {log.billable_activities?.length > 1 ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700">
                                                    Flere Aktiviteter
                                                </span>
                                            ) : activity && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-primary-100 text-primary-700">
                                                    {activity.name}
                                                </span>
                                            )}`
);



fs.writeFileSync(path, code);
console.log("Updated successful!");
