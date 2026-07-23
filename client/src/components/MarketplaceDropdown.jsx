import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import api from '../services/api';

const MarketplaceDropdown = ({ selectedId, onChange, hideLabel = false }) => {
    const [marketplaces, setMarketplaces] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editData, setEditData] = useState({ id: null, name: "" });
    const [isLoading, setIsLoading] = useState(false);
    
    const dropdownRef = useRef(null);

    const fetchMarketplaces = async () => {
        try {
            const response = await api.get("/marketplaces");
            if (response.data && response.data.data) {
                setMarketplaces(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching marketplaces:", error);
        }
    };

    useEffect(() => {
        fetchMarketplaces();
    }, []);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!editData.name.trim()) return alert("Name is required");
        
        setIsLoading(true);
        try {
            if (editData.id) {
                await api.put(`/marketplaces/${editData.id}`, { name: editData.name });
            } else {
                await api.post("/marketplaces", { name: editData.name });
            }
            await fetchMarketplaces();
            setIsModalOpen(false);
        } catch (error) {
            alert("Failed to save marketplace");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this marketplace?")) return;
        setIsLoading(true);
        try {
            await api.delete(`/marketplaces/${editData.id}`);
            if (selectedId === editData.id) onChange("", ""); // clear selection if deleted
            await fetchMarketplaces();
            setIsModalOpen(false);
        } catch (error) {
            alert("Failed to delete marketplace");
        } finally {
            setIsLoading(false);
        }
    };

    const openAddModal = () => {
        setEditData({ id: null, name: "" });
        setIsModalOpen(true);
        setIsOpen(false);
    };

    const openEditModal = (e, mp) => {
        e.stopPropagation(); // prevent dropdown selection
        setEditData({ id: mp.id, name: mp.name });
        setIsModalOpen(true);
        setIsOpen(false);
    };

    const selectedName = marketplaces.find(m => String(m.id) === String(selectedId))?.name || "Select a Marketplace";

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {!hideLabel && (
                <label className="block text-sm font-bold text-[#1C2340] mb-2">Select Marketplace <span className="text-red-500">*</span></label>
            )}
            
            {/* Custom Select Box */}
            <div 
                className="w-full px-3 py-1.5 border border-[#D9DDE5] rounded-[4px] text-[12px] bg-white cursor-pointer flex justify-between items-center text-[#1C2340] hover:border-[#5A5DF6] transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedId ? "font-semibold" : "text-gray-400"}>{selectedName}</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#5A5DF6]' : 'text-gray-400'}`} />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#D9DDE5] rounded-[5px] shadow-lg max-h-60 overflow-y-auto">
                    {marketplaces.map((mp) => (
                        <div 
                            key={mp.id} 
                            className={`flex justify-between items-center px-4 py-2.5 cursor-pointer text-[12px] transition-colors ${String(selectedId) === String(mp.id) ? 'bg-[#5A5DF6]/10 text-[#5A5DF6] font-semibold' : 'hover:bg-gray-50 text-[#1C2340]'}`}
                            onClick={() => { onChange(mp.id, mp.name); setIsOpen(false); }}
                        >
                            <span>{mp.name}</span>
                            <button 
                                onClick={(e) => openEditModal(e, mp)}
                                className="p-1 rounded hover:bg-[#D9DDE5] text-gray-400 hover:text-[#5A5DF6] transition-colors"
                                title="Edit"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                    ))}
                    
                    <div 
                        className="flex items-center gap-2 px-4 py-3 bg-[#F4F5F7]/50 border-t border-[#D9DDE5] cursor-pointer hover:bg-[#F4F5F7] text-[#5A5DF6] font-bold text-sm transition-colors"
                        onClick={openAddModal}
                    >
                        <Plus size={16} /> Add New Marketplace
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b flex justify-between items-center bg-[#F4F5F7]">
                            <h3 className="font-bold text-[#1C2340] text-sm">
                                {editData.id ? "Edit Marketplace" : "Add Marketplace"}
                            </h3>
                            <button onClick={(e) => { e.preventDefault(); setIsModalOpen(false); }} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs text-gray-600 block mb-1">Marketplace Name</label>
                                <input 
                                    type="text" 
                                    value={editData.name}
                                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-[#5A5DF6]"
                                    placeholder="e.g. Amazon"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 pt-2">
                                {editData.id && (
                                    <button 
                                        type="button" 
                                        onClick={handleDelete}
                                        disabled={isLoading}
                                        className="p-2 border border-red-200 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <div className="flex-1"></div>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                                <button type="submit" disabled={isLoading || !editData.name} className="px-5 py-2 bg-[#5A5DF6] text-white text-sm font-bold rounded hover:bg-[#494ce0] flex items-center gap-2 transition-all disabled:opacity-70">
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplaceDropdown;
