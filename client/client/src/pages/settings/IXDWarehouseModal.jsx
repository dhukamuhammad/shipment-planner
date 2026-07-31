import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Package, Search, X, ChevronDown, ChevronRight } from 'lucide-react';

const IXDWarehouseModal = ({ isOpen, onClose }) => {
    const [warehouses, setWarehouses] = useState({}); // { IXD: { amazone: [], flipkart: [] }, Warehouse: { amazone: [] } }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('IXD'); // 'IXD' or 'Warehouse'
    const [expandedPlatforms, setExpandedPlatforms] = useState({});

    useEffect(() => {
        if (isOpen) {
            fetchWarehouses();
        }
    }, [isOpen]);

    const fetchWarehouses = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/ixd-warehouses');
            if (response.data?.success) {
                setWarehouses(response.data.data);
                
                // Initialize expanded state for first platform if available
                const data = response.data.data;
                const newExpanded = {};
                ['IXD', 'Warehouse'].forEach(type => {
                    if (data[type]) {
                        const platforms = Object.keys(data[type]);
                        if (platforms.length > 0) {
                            newExpanded[`${type}-${platforms[0]}`] = true;
                        }
                    }
                });
                setExpandedPlatforms(newExpanded);
            }
        } catch (err) {
            console.error("Failed to fetch IXD Warehouses", err);
            setError("Failed to load IXD Warehouses.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggle = async (id, currentStatus, type, platform) => {
        try {
            const newStatus = !currentStatus;
            
            // Optimistic update
            setWarehouses(prev => {
                const updated = { ...prev };
                if (updated[type] && updated[type][platform]) {
                    updated[type][platform] = updated[type][platform].map(wh => 
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

    const togglePlatform = (type, platform) => {
        setExpandedPlatforms(prev => ({
            ...prev,
            [`${type}-${platform}`]: !prev[`${type}-${platform}`]
        }));
    };

    if (!isOpen) return null;

    const currentData = warehouses[activeTab] || {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[12px] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2">
                        <Package size={20} className="text-[#5A5DF6]" />
                        Warehouse Settings
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs & Search */}
                <div className="px-6 py-3 border-b border-[#D9DDE5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex bg-gray-100 p-1 rounded-[8px] self-start sm:self-auto">
                        <button
                            onClick={() => setActiveTab('IXD')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-[5px] transition-colors ${
                                activeTab === 'IXD' ? 'bg-white text-[#5A5DF6] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            IXD
                        </button>
                        <button
                            onClick={() => setActiveTab('Warehouse')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-[5px] transition-colors ${
                                activeTab === 'Warehouse' ? 'bg-white text-[#5A5DF6] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Warehouse
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-auto pl-9 pr-3 py-1.5 border border-[#D9DDE5] rounded-[5px] text-sm focus:outline-none focus:border-[#5A5DF6] transition-colors"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FA]">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 size={32} className="animate-spin text-[#5A5DF6]" /></div>
                    ) : error ? (
                        <div className="text-red-500 text-sm font-medium text-center bg-red-50 p-4 rounded-md border border-red-100">{error}</div>
                    ) : Object.keys(currentData).length === 0 ? (
                        <div className="text-gray-500 text-sm text-center py-12 bg-white rounded-[8px] border border-dashed border-[#D9DDE5]">
                            No {activeTab} warehouses found. Upload a Calculation Report to add them.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(currentData).map(([platform, items]) => {
                                const filtered = items.filter(w => w.name.toLowerCase().includes(search.toLowerCase()));
                                if (filtered.length === 0 && search) return null;
                                
                                const isExpanded = expandedPlatforms[`${activeTab}-${platform}`];

                                return (
                                    <div key={platform} className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm transition-all">
                                        <button 
                                            onClick={() => togglePlatform(activeTab, platform)}
                                            className="w-full px-5 py-3 bg-white hover:bg-gray-50 flex items-center justify-between border-b border-transparent transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                                                <h3 className="font-bold text-[#1C2340] capitalize">{platform}</h3>
                                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-2">
                                                    {filtered.length}
                                                </span>
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="divide-y divide-[#F0F2F5] border-t border-[#D9DDE5] bg-gray-50/50">
                                                {filtered.map(wh => (
                                                    <div key={wh.id} className="flex items-center justify-between px-6 py-3 hover:bg-white transition-colors">
                                                        <div className="font-medium text-sm text-[#1C2340]">{wh.name}</div>
                                                        <button
                                                            onClick={() => handleToggle(wh.id, wh.is_active, activeTab, platform)}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#5A5DF6] focus:ring-offset-1 ${
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IXDWarehouseModal;
