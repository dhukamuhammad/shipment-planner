import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Calendar, Plus, Minus, Trash2, Loader2, AlertCircle, CalendarDays, X } from 'lucide-react';

const EventCalendar = () => {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const [newEvent, setNewEvent] = useState({
        event_name: '',
        start_date: '',
        end_date: '',
        multiplier: 1.1,
        remind_before_value: 3,
        remind_before_unit: 'days'
    });

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/events');
            if (response.data?.success) {
                setEvents(response.data.data);
            }
        } catch (err) {
            console.error("Failed to load events", err);
            setError("Failed to load events from server.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleAddEvent = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        try {
            await api.post('/events', newEvent);
            setNewEvent({ event_name: '', start_date: '', end_date: '', multiplier: 1.1, remind_before_value: 3, remind_before_unit: 'days' });
            setShowModal(false);
            await fetchEvents();
        } catch (err) {
            console.error("Failed to add event", err);
            setError("Failed to add event.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this event?")) return;
        try {
            await api.delete(`/events/${id}`);
            await fetchEvents();
        } catch (err) {
            console.error("Failed to delete event", err);
            setError("Failed to delete event.");
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setNewEvent({ event_name: '', start_date: '', end_date: '', multiplier: 1.1, remind_before_value: 3, remind_before_unit: 'days' });
        setError(null);
    };

    return (
        <>
            <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm mt-6">
                {/* Header */}
                <div
                    className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center cursor-pointer select-none"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-[#5A5DF6]" />
                        <h2 className="text-base font-bold text-[#1C2340]">Event Calendar (Multipliers)</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {isLoading && <Loader2 size={16} className="text-[#5A5DF6] animate-spin" />}

                        {/* Add Event button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#5A5DF6] bg-[#5A5DF6]/10 hover:bg-[#5A5DF6] hover:text-white transition-colors text-[#5A5DF6] text-xs font-medium"
                            title="Add Event"
                        >
                            <Plus size={13} />
                            Add Event
                        </button>

                        {/* Collapse / Expand button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-[#D9DDE5] bg-white hover:bg-[#5A5DF6]/10 hover:border-[#5A5DF6] transition-colors text-[#5A5DF6]"
                            title={isOpen ? 'Collapse' : 'Expand'}
                        >
                            {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                {isOpen && (
                    <div className="p-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[5px] flex items-center gap-2 text-sm font-medium mb-4">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div>
                            <h3 className="text-sm font-bold text-[#1C2340] mb-3">Scheduled Events</h3>
                            {events.length === 0 && !isLoading ? (
                                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                    <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No upcoming events scheduled.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200">Event Name</th>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200">Start Date</th>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200">End Date</th>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200">Multiplier</th>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200">Remind</th>
                                                <th className="px-4 py-3 font-medium border-b border-gray-200 w-16">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {events.map((event) => (
                                                <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                                    <td className="px-4 py-3 font-medium text-[#1C2340]">{event.event_name}</td>
                                                    <td className="px-4 py-3 text-gray-600">{new Date(event.start_date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 text-gray-600">{new Date(event.end_date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-[#5A5DF6]/10 text-[#5A5DF6] px-2 py-1 rounded text-xs font-bold">
                                                            {event.multiplier}x
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                                        {event.remind_before_value} {event.remind_before_unit}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => handleDelete(event.id)}
                                                            className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Event Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                >
                    <div
                        className="bg-white rounded-[10px] shadow-xl w-full max-w-md mx-4 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CalendarDays size={18} className="text-[#5A5DF6]" />
                                <h3 className="text-base font-bold text-[#1C2340]">Add Event</h3>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-500"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleAddEvent} className="p-6 flex flex-col gap-4">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded flex items-center gap-2 text-sm">
                                    <AlertCircle size={14} />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Event Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newEvent.event_name}
                                    onChange={(e) => setNewEvent({ ...newEvent, event_name: e.target.value })}
                                    placeholder="e.g. Diwali Sale"
                                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Start Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEvent.start_date}
                                        onChange={(e) => setNewEvent({ ...newEvent, start_date: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">End Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newEvent.end_date}
                                        onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
                                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Multiplier (e.g. 1.5)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="1.1"
                                    required
                                    value={newEvent.multiplier}
                                    onChange={(e) => setNewEvent({ ...newEvent, multiplier: e.target.value })}
                                    className="w-full text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Remind Before</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={newEvent.remind_before_value}
                                        onChange={(e) => setNewEvent({ ...newEvent, remind_before_value: e.target.value })}
                                        className="w-24 text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6]"
                                        placeholder="3"
                                    />
                                    <select
                                        value={newEvent.remind_before_unit}
                                        onChange={(e) => setNewEvent({ ...newEvent, remind_before_unit: e.target.value })}
                                        className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#5A5DF6] bg-white"
                                    >
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                    </select>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 flex justify-center items-center gap-2 bg-[#5A5DF6] hover:bg-[#4a4cd6] text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                                >
                                    {isAdding ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default EventCalendar;
