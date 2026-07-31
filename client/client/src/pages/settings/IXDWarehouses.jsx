import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Package, Search } from 'lucide-react';

const IXDWarehouses = () => {
    const [warehouses, setWarehouses] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/ixd-warehouses');
            if (response.data?.success) {
                setWarehouses(response.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch IXD Warehouses", err);
            setError("Failed to load IXD Warehouses.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id, currentStatus) => {
        try {
            const newStatus = !currentStatus;
            
            // Optimistic update
            setWarehouses(prev => {
                const updated = { ...prev };
                for (const platform in updated) {
                    updated[platform] = updated[platform].map(wh => 
                        wh.id === id ? { ...wh, is_active: newStatus } : wh
                    );
                }
                return updated;
            });

            await api.post('/ixd-warehouses/toggle', { id, is_active: newStatus });
        } catch (err) {
            console.error("Toggle error", err);
            // Revert on error
            fetchWarehouses();
        }
    };

    return (
        <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                <h2 className="text-base font-bold text-[#1C2340] flex items-center gap-2">
                    <Package size={18} className="text-[#5A5DF6]" />
                    IXD Warehouses
                </h2>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search warehouses..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-3 py-1.5 border border-[#D9DDE5] rounded-[5px] text-sm focus:outline-none focus:border-[#5A5DF6] transition-colors"
                    />
                </div>
            </div>

            <div className="p-6 space-y-6">
                {isLoading ? (
                    <div className="flex justify-center p-4"><Loader2 size={24} className="animate-spin text-[#5A5DF6]" /></div>
                ) : error ? (
                    <div className="text-red-500 text-sm font-medium">{error}</div>
                ) : Object.keys(warehouses).length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-4">No IXD warehouses found. Upload a Calculation Report template to add them.</div>
                ) : (
                    Object.entries(warehouses).map(([platform, items]) => {
                        const filtered = items.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));
                        if (filtered.length === 0 && search) return null;

                        return (
                            <div key={platform} className="border border-[#D9DDE5] rounded-[5px] overflow-hidden">
                                <div className="bg-[#F4F5F7] px-4 py-2 border-b border-[#D9DDE5]">
                                    <h3 className="font-bold text-[#1C2340] capitalize">{platform}</h3>
                                </div>
                                <div className="divide-y divide-[#D9DDE5]">
                                    {filtered.map(wh => (
                                        <div key={wh.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                                            <div className="font-medium text-sm text-[#1C2340]">{wh.name}</div>
                                            <button
                                                onClick={() => handleToggle(wh.id, wh.is_active)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                    wh.is_active ? 'bg-[#22B573]' : 'bg-gray-300'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                        wh.is_active ? 'translate-x-5' : 'translate-x-1'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default IXDWarehouses;
