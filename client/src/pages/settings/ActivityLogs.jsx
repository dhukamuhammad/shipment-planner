import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, AlertCircle, Clock, User, Activity, Layout, FileText } from 'lucide-react';

const ActivityLogs = ({ userId = null, isModal = false }) => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, [userId]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const url = userId ? `/activity-logs?userId=${userId}` : '/activity-logs';
            const res = await api.get(url);
            if (res.data.success) {
                setLogs(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch activity logs", err);
            setError('Failed to load activity logs.');
        } finally {
            setIsLoading(false);
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'CREATE': return 'bg-green-100 text-green-700';
            case 'UPDATE': return 'bg-blue-100 text-blue-700';
            case 'DELETE': return 'bg-red-100 text-red-700';
            case 'UPLOAD': return 'bg-purple-100 text-purple-700';
            case 'DOWNLOAD': return 'bg-indigo-100 text-indigo-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className={isModal ? "" : "bg-white rounded-lg shadow-sm border border-[#EAEBF3]"}>
            {!isModal && (
                <div className="p-4 border-b border-[#EAEBF3] flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[#E63946]" />
                            Activity Logs
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">Track all actions performed by users in the system</p>
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="px-3 py-1.5 text-xs bg-white border border-[#D9DDE5] rounded hover:bg-gray-50 text-[#1C2340] flex items-center gap-1"
                    >
                        <Clock className="w-3.5 h-3.5" /> Refresh
                    </button>
                </div>
            )}

            <div className={isModal ? "" : "p-4"}>
                {error && (
                    <div className="mb-4 bg-red-50 text-red-500 p-3 rounded-md text-sm flex items-center gap-2 border border-red-100">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[#E63946]" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-md border border-dashed border-gray-200">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No activity logs found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-md border border-[#EAEBF3]">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-[#EAEBF3] text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="p-3">Time</th>
                                    {!isModal && <th className="p-3">User</th>}
                                    <th className="p-3">Action</th>
                                    <th className="p-3">Module</th>
                                    <th className="p-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EAEBF3] text-sm">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-3 text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(log.created_at).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', hour12: true
                                                })}
                                            </div>
                                        </td>
                                        {!isModal && (
                                            <td className="p-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 font-medium text-[#1C2340]">
                                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                                    {log.user_name || 'System / Unknown'}
                                                </div>
                                                {log.user_email && <div className="text-xs text-gray-400 ml-5">{log.user_email}</div>}
                                            </td>
                                        )}
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                <Layout className="w-3.5 h-3.5" />
                                                {log.module}
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-700 break-words max-w-md">
                                            <div className="flex items-start gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                {log.description}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityLogs;
