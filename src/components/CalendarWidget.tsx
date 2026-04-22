import { useState, useCallback, useEffect } from 'react';
import { Calendar as CalendarIcon, Plus, X, RefreshCw, Globe } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { Event as BigCalendarEventType, EventProps } from 'react-big-calendar';
// @ts-ignore
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
// @ts-ignore
import type { EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns';
import { nb } from 'date-fns/locale';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = {
    'nb': nb,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

const CalendarComponent = withDragAndDrop(Calendar) as any;

interface CustomEvent extends BigCalendarEventType {
    id: string;
    description?: string;
    htmlLink?: string;
    sourceEvent: any;
}

const messages = {
    allDay: 'Hele dagen',
    previous: 'Forrige',
    next: 'Neste',
    today: 'I dag',
    month: 'Måned',
    week: 'Uke',
    day: 'Dag',
    agenda: 'Agenda',
    date: 'Dato',
    time: 'Tid',
    event: 'Hendelse',
    noEventsInRange: 'Ingen kalenderavtaler funnet.',
    showMore: (total: number) => `+ ${total} flere`,
};

export default function CalendarWidget() {
    const [events, setEvents] = useState<CustomEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEvent, setNewEvent] = useState<{ title: string; date: string; time: string; duration: string }>({ title: '', date: '', time: '12:00', duration: '60' });
    const [adding, setAdding] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CustomEvent | null>(null);
    const [editEventParams, setEditEventParams] = useState({ title: '', date: '', time: '12:00', duration: '60' });
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('week');

    useEffect(() => {
        const storedToken = localStorage.getItem('google_access_token');
        const expiresAtStr = localStorage.getItem('google_token_expires_at');
        if (storedToken && expiresAtStr) {
            const expiresAt = parseInt(expiresAtStr, 10);
            if (Date.now() < expiresAt) {
                setAccessToken(storedToken);
                setIsAuthenticated(true);
                fetchEvents(storedToken);
            } else {
                localStorage.removeItem('google_access_token');
                localStorage.removeItem('google_token_expires_at');
            }
        }
    }, []);

    const login = useGoogleLogin({
        onSuccess: tokenResponse => {
            console.log("Login success, token received.");
            
            // Store token to survive page reloads (expires_in is usually 3599 seconds)
            const expiresIn = tokenResponse.expires_in || 3599; 
            const expiresAt = Date.now() + (expiresIn * 1000);
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            localStorage.setItem('google_token_expires_at', expiresAt.toString());

            setAccessToken(tokenResponse.access_token);
            setIsAuthenticated(true);
            fetchEvents(tokenResponse.access_token);
        },
        onError: error => {
            console.error('Login Failed', error);
            setErrorMsg("Innlogging feilet. Prøv igjen.");
        },
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        flow: 'implicit',
        prompt: 'consent',
    });

    const handleLoginClick = () => {
        setErrorMsg(null);
        login();
    };

    const fetchEvents = async (token: string) => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const timeMin = new Date();
            timeMin.setFullYear(timeMin.getFullYear() - 1); // Fetch 1 year back
            const timeMax = new Date();
            timeMax.setFullYear(timeMax.getFullYear() + 2); // And 2 years into future

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=2500`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                const calendarEvents: CustomEvent[] = (data.items || []).map((ev: any) => {
                    const isAllDay = !!ev.start.date;
                    const start = new Date(ev.start.dateTime || ev.start.date);
                    let end = new Date(ev.end.dateTime || ev.end.date);

                    if (isAllDay) {
                        end = new Date(end.getTime() - 1);
                    }

                    return {
                        id: ev.id,
                        title: ev.summary || '(Uten tittel)',
                        start,
                        end,
                        allDay: isAllDay,
                        htmlLink: ev.htmlLink,
                        description: ev.description,
                        sourceEvent: ev
                    };
                });

                setEvents(calendarEvents);
            } else {
                const errText = await response.text();
                console.error("Failed to fetch events", errText);
                if (response.status === 401 || response.status === 403) {
                    setIsAuthenticated(false);
                    setAccessToken(null);
                    localStorage.removeItem('google_access_token');
                    localStorage.removeItem('google_token_expires_at');
                    if (response.status === 403) {
                        setErrorMsg("Mangler tillatelse. Sørg for å krysse av for alle tilganger når du logger inn, eller sjekk om Calendar API er aktivert.");
                    }
                } else {
                    setErrorMsg(`Kunne ikke hente kalender: ${response.status}`);
                }
            }
        } catch (error) {
            console.error('Error fetching calendar events', error);
            setErrorMsg("Nettverksfeil ved henting av kalender.");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (accessToken) {
            fetchEvents(accessToken);
        }
    };

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accessToken || !newEvent.title) return;

        setAdding(true);
        try {
            const startDateTime = new Date(`${newEvent.date}T${newEvent.time}`);
            const endDateTime = new Date(startDateTime.getTime() + parseInt(newEvent.duration) * 60000);

            const eventBody = {
                summary: newEvent.title,
                start: {
                    dateTime: startDateTime.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                    dateTime: endDateTime.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            };

            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
            });

            if (response.ok) {
                setShowAddModal(false);
                setNewEvent({ title: '', date: '', time: '12:00', duration: '60' });
                fetchEvents(accessToken);
            } else {
                alert('Kunne ikke opprette hendelse i Google Kalender');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAdding(false);
        }
    };

    const onEventDrop = useCallback(async ({ event, start, end, isAllDay }: EventInteractionArgs<CustomEvent>) => {
        if (!accessToken) return;

        const updatedEvents = events.map(ev =>
            ev.id === event.id ? { ...ev, start: new Date(start), end: new Date(end), allDay: isAllDay } : ev
        );
        setEvents(updatedEvents);

        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    start: isAllDay ? { date: new Date(start).toISOString().split('T')[0] } : { dateTime: new Date(start).toISOString() },
                    end: isAllDay ? { date: addDays(new Date(end), 1).toISOString().split('T')[0] } : { dateTime: new Date(end).toISOString() },
                })
            });
            if (!response.ok) {
                fetchEvents(accessToken);
            }
        } catch (err) {
            console.error(err);
            fetchEvents(accessToken);
        }
    }, [events, accessToken]);

    const onEventResize = useCallback(async ({ event, start, end }: EventInteractionArgs<CustomEvent>) => {
        if (!accessToken) return;

        const updatedEvents = events.map(ev =>
            ev.id === event.id ? { ...ev, start: new Date(start), end: new Date(end) } : ev
        );
        setEvents(updatedEvents);

        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    start: { dateTime: new Date(start).toISOString() },
                    end: { dateTime: new Date(end).toISOString() }
                })
            });
            if (!response.ok) {
                fetchEvents(accessToken);
            }
        } catch (err) {
            console.error(err);
            fetchEvents(accessToken);
        }
    }, [events, accessToken]);

    const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
        if (!isAuthenticated) return;
        setNewEvent({
            title: '',
            date: format(start, 'yyyy-MM-dd'),
            time: format(start, 'HH:mm'),
            duration: Math.round((end.getTime() - start.getTime()) / 60000).toString()
        });
        setShowAddModal(true);
    }, [isAuthenticated]);

    const handleSelectEvent = useCallback((event: CustomEvent) => {
        if (!isAuthenticated || !event.start || !event.end) return;
        setSelectedEvent(event);
        setEditEventParams({
            title: event.title as string,
            date: event.start.toISOString().split('T')[0],
            time: event.start.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }),
            duration: Math.round((event.end.getTime() - event.start.getTime()) / 60000).toString()
        });
        setShowEditModal(true);
    }, [isAuthenticated]);

    const handleEditEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accessToken || !selectedEvent || !editEventParams.title) return;
        setUpdating(true);
        try {
            let startDateTime = new Date(`${editEventParams.date}T${editEventParams.time}`);
            let endDateTime = new Date(startDateTime.getTime() + parseInt(editEventParams.duration) * 60000);

            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${selectedEvent.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    summary: editEventParams.title,
                    start: { dateTime: startDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                    end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
                })
            });
            if (response.ok) {
                setShowEditModal(false);
                fetchEvents(accessToken);
            } else {
                alert('Kunne ikke oppdatere hendelse.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!accessToken || !selectedEvent) return;
        if (!window.confirm('Er du sikker på at du vil slette denne hendelsen?')) return;
        setDeleting(true);
        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${selectedEvent.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.ok) {
                setShowEditModal(false);
                fetchEvents(accessToken);
            } else {
                alert('Kunne ikke slette hendelse.');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDeleting(false);
        }
    };

    const eventPropGetter = useCallback(() => {
        return {
            className: 'bg-[#4285F4] border-none text-white text-xs font-semibold rounded shadow-sm hover:opacity-90 transition-opacity',
            style: {
                borderRadius: '6px'
            }
        };
    }, []);

    const EventComponent = ({ event }: EventProps<CustomEvent>) => {
        return (
            <div className="flex flex-col overflow-hidden h-full text-[11px] leading-snug px-1 pt-0.5" title={event.title as string}>
                <div className="font-bold truncate">{event.title as string}</div>
            </div>
        );
    }

    const formats = {
        timeGutterFormat: 'HH:mm',
        eventTimeRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
            localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture),
        agendaTimeRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
            localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture),
        agendaTimeFormat: 'HH:mm',
        selectRangeFormat: ({ start, end }: any, culture: any, localizer: any) =>
            localizer.format(start, 'HH:mm', culture) + ' - ' + localizer.format(end, 'HH:mm', culture),
        dayFormat: 'EEEE d. MMM',
    };

    return (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col h-full ring-1 ring-slate-900/5 transition-all relative">
            <style>
                {`
                    .rbc-calendar { font-family: inherit; }
                    .rbc-btn-group button { color: #475569; font-weight: 600; font-size: 13px; border-color: #e2e8f0; }
                    .rbc-btn-group button.rbc-active { background-color: #f1f5f9; box-shadow: none; color: #0f172a; }
                    .rbc-btn-group button:hover { background-color: #f8fafc; }
                    .rbc-toolbar button { padding: 6px 14px; }
                    .rbc-toolbar-label { font-weight: 800; font-size: 18px; color: #1e293b; text-transform: capitalize; }
                    .rbc-header { padding: 8px; font-weight: 700; font-size: 13px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
                    .rbc-time-header-content { border-left-color: #e2e8f0; }
                    .rbc-time-content { border-top-color: #e2e8f0; }
                    .rbc-day-slot .rbc-time-slot { border-top-color: #f1f5f9; }
                    .rbc-timeslot-group { border-bottom-color: #e2e8f0; min-height: 50px; }
                    .rbc-day-bg + .rbc-day-bg { border-left-color: #e2e8f0; }
                    .rbc-month-row + .rbc-month-row { border-top-color: #e2e8f0; }
                    .rbc-today { background-color: #f0fdf4; }
                    .rbc-time-view, .rbc-month-view { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                    .rbc-event { padding: 2px 4px; }
                    .rbc-addons-dnd .rbc-addons-dnd-resizable { padding: 0 !important; }
                `}
            </style>

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <div className="bg-[#4285F4]/10 p-2.5 rounded-xl mr-3">
                        <CalendarIcon className="w-5 h-5 text-[#4285F4]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Min Kalender</h2>
                        {isAuthenticated ? (
                            <p className="text-xs font-bold text-green-600 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                Synkronisert
                            </p>
                        ) : (
                            <p className="text-xs font-medium text-slate-500">
                                Google Kalender
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isAuthenticated ? (
                        <div className="flex gap-2">
                            <button
                                onClick={handleRefresh}
                                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
                                title="Oppdater kalender"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => {
                                    setNewEvent({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '12:00', duration: '60' });
                                    setShowAddModal(true);
                                }}
                                className="px-3 py-1.5 bg-primary-50 text-primary-700 text-xs font-bold rounded-lg uppercase tracking-widest hover:bg-primary-100 transition-colors flex items-center"
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Ny
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLoginClick}
                            className="px-4 py-2 bg-[#4285F4] text-white text-xs font-bold rounded-xl flex items-center hover:bg-[#3367D6] transition-colors shadow-sm"
                        >
                            <Globe className="w-4 h-4 mr-2" />
                            Logg inn med Google
                        </button>
                    )}
                </div>
            </div>

            <div className="h-[450px] relative mt-2">
                {!isAuthenticated ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 z-10">
                        <CalendarIcon className="w-12 h-12 text-slate-300 mb-3" />
                        <h3 className="text-slate-700 font-bold mb-1">Koble til kalender</h3>
                        <p className="text-slate-500 text-sm max-w-sm">Logg inn for å se dine kommende avtaler, flytte dem direkte i kalendervisningen, og synkronisere alt til Google Kalender.</p>
                    </div>
                ) : loading && events.length === 0 ? (
                    <div className="absolute inset-0 flex justify-center py-10 z-10 bg-white/50 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mt-20"></div>
                    </div>
                ) : errorMsg ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-red-50 text-red-600 rounded-2xl border border-red-200 z-10">
                        <X className="w-8 h-8 mb-2" />
                        <p className="font-bold text-sm">{errorMsg}</p>
                    </div>
                ) : null}

                <div className={`h-full w-full transition-opacity duration-300 ${!isAuthenticated || (loading && events.length === 0) ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                    <CalendarComponent
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        view={view}
                        onView={(newView: string) => setView(newView as any)}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        onEventDrop={onEventDrop}
                        onEventResize={onEventResize}
                        resizable
                        selectable
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventPropGetter}
                        components={{
                            event: EventComponent
                        }}
                        messages={messages}
                        formats={formats}
                        defaultView={Views.WEEK}
                        scrollToTime={new Date(1970, 1, 1, 7)}
                        step={15}
                        timeslots={4}
                        popup
                    />
                </div>
            </div>

            {/* Add Event Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200/60" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <CalendarIcon className="w-5 h-5 mr-2 text-[#4285F4]" />
                                Ny kalenderavtale
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddEvent} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tittel på avtale</label>
                                <input
                                    type="text"
                                    required
                                    value={newEvent.title}
                                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    placeholder="F.eks. Byggemøte"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Dato</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEvent.date}
                                        onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tidspunkt</label>
                                    <input
                                        type="time"
                                        required
                                        value={newEvent.time}
                                        onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Varighet</label>
                                <select
                                    value={newEvent.duration}
                                    onChange={e => setNewEvent({ ...newEvent, duration: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all cursor-pointer"
                                >
                                    <option value="15">15 minutter</option>
                                    <option value="30">30 minutter</option>
                                    <option value="45">45 minutter</option>
                                    <option value="60">1 time</option>
                                    <option value="90">1.5 timer</option>
                                    <option value="120">2 timer</option>
                                    <option value="custom">Egendefinert (valgt i kalender)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="submit"
                                    disabled={adding || !newEvent.title}
                                    className="px-5 py-2.5 text-sm font-bold bg-[#4285F4] text-white rounded-xl hover:bg-[#3367D6] transition-all flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {adding ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Lagrer...</>
                                    ) : (
                                        'Opprett og synkroniser'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit/Delete Event Modal */}
            {showEditModal && selectedEvent && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200/60" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-extrabold text-slate-800 flex items-center">
                                <CalendarIcon className="w-5 h-5 mr-2 text-[#4285F4]" />
                                Rediger kalenderavtale
                            </h3>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-2 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditEvent} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tittel på avtale</label>
                                <input
                                    type="text"
                                    required
                                    value={editEventParams.title}
                                    onChange={e => setEditEventParams({ ...editEventParams, title: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Dato</label>
                                    <input
                                        type="date"
                                        required
                                        value={editEventParams.date}
                                        onChange={e => setEditEventParams({ ...editEventParams, date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tidspunkt</label>
                                    <input
                                        type="time"
                                        required
                                        value={editEventParams.time}
                                        onChange={e => setEditEventParams({ ...editEventParams, time: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Varighet</label>
                                <select
                                    value={editEventParams.duration}
                                    onChange={e => setEditEventParams({ ...editEventParams, duration: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] block p-3 font-medium transition-all cursor-pointer"
                                >
                                    <option value="15">15 minutter</option>
                                    <option value="30">30 minutter</option>
                                    <option value="45">45 minutter</option>
                                    <option value="60">1 time</option>
                                    <option value="90">1.5 timer</option>
                                    <option value="120">2 timer</option>
                                    <option value="custom">Egendefinert</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-between gap-3 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={handleDeleteEvent}
                                    disabled={deleting}
                                    className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                                >
                                    {deleting ? 'Sletter...' : 'Slett'}
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updating || !editEventParams.title}
                                        className="px-5 py-2 text-sm font-bold bg-[#4285F4] text-white rounded-xl hover:bg-[#3367D6] transition-all disabled:opacity-50"
                                    >
                                        {updating ? 'Lagrer...' : 'Lagre'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
