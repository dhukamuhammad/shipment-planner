import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader2, Package, Search, X, ChevronDown, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';

const IXDWarehouseModal = ({ isOpen, onClose }) => {
    const [warehouses, setWarehouses] = useState({}); // { IXD: { amazone: [], flipkart: [] }, Warehouse: { amazone: [] } }
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('IXD'); // 'IXD' or 'Warehouse'
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPlatform, setNewPlatform] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPlatform, setEditPlatform] = useState('');
    const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const allPlatforms = React.useMemo(() => {
        const platforms = new Set();
        if (warehouses['IXD']) Object.keys(warehouses['IXD']).forEach(p => platforms.add(p));
        if (warehouses['Warehouse']) Object.keys(warehouses['Warehouse']).forEach(p => platforms.add(p));
        return Array.from(platforms).sort();
    }, [warehouses]);

    useEffect(() => {
        if (allPlatforms.length > 0 && !selectedPlatform) {
            setSelectedPlatform(allPlatforms[0]);
        }
    }, [allPlatforms, selectedPlatform]);

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

    const openAddPopup = () => {
        setNewName('');
        setNewPlatform(selectedPlatform || (allPlatforms.length > 0 ? allPlatforms[0] : 'amazone'));
        setAddError('');
        setIsAddPopupOpen(true);
    };

    const handleSaveNewWarehouse = async () => {
        if (!newName.trim()) {
            setAddError('Name is required');
            return;
        }
        if (!newPlatform) {
            setAddError('Platform is required');
            return;
        }

        setIsAdding(true);
        setAddError('');

        try {
            const response = await api.post('/ixd-warehouses/add', {
                name: newName.trim(),
                type: activeTab,
                platform: newPlatform
            });
            
            if (response.data?.success) {
                setIsAddPopupOpen(false);
                fetchWarehouses();
            } else {
                setAddError(response.data?.message || 'Failed to add');
            }
        } catch (err) {
            console.error('Error adding warehouse:', err);
            setAddError(err.response?.data?.message || 'Failed to add. It might already exist.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleEditSave = async (id, type) => {
        if (!editName.trim()) return;
        setIsActionLoading(true);
        try {
            const response = await api.put(`/ixd-warehouses/${id}`, { 
                name: editName.trim(), 
                platform: editPlatform 
            });
            if (response.data?.success) {
                setEditingId(null);
                setIsEditPopupOpen(false);
                fetchWarehouses(); // Refresh list to reflect platform change
            }
        } catch (err) {
            console.error('Error editing warehouse:', err);
            alert(err.response?.data?.message || 'Failed to update warehouse');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDelete = async (id, name, platform, type) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${name}"?`)) return;
        
        setIsActionLoading(true);
        try {
            const response = await api.delete(`/ixd-warehouses/${id}`);
            if (response.data?.success) {
                setWarehouses(prev => {
                    const updated = { ...prev };
                    if (updated[type] && updated[type][platform]) {
                        updated[type][platform] = updated[type][platform].filter(wh => wh.id !== id);
                    }
                    return updated;
                });
            }
        } catch (err) {
            console.error('Error deleting warehouse:', err);
            alert('Failed to delete warehouse');
        } finally {
            setIsActionLoading(false);
        }
    };

    if (!isOpen) return null;

    const currentData = warehouses[activeTab] || {};

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[12px] shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                    <div className="flex bg-gray-100 p-1 rounded-[8px] self-start sm:self-auto items-center gap-1">
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

                        {allPlatforms.length > 0 && (
                            <>
                                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                <select 
                                    value={selectedPlatform}
                                    onChange={(e) => setSelectedPlatform(e.target.value)}
                                    className="bg-white px-3 py-1.5 rounded-[5px] text-sm font-medium border-none outline-none text-[#1C2340] cursor-pointer shadow-sm capitalize"
                                >
                                    {allPlatforms.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>
                    <button
                        onClick={openAddPopup}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5A5DF6] text-white text-sm font-medium rounded-[5px] hover:bg-[#4a4cd6] transition-colors shadow-sm self-start sm:self-auto"
                    >
                        <Plus size={16} />
                        Add {activeTab}
                    </button>
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
                        <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm">
                            <div className="divide-y divide-[#F0F2F5]">
                                {(() => {
                                    const items = currentData[selectedPlatform] || [];

                                    if (items.length === 0) {
                                        return (
                                            <div className="text-gray-500 text-sm text-center py-8">
                                                No {activeTab} found for {selectedPlatform}.
                                            </div>
                                        );
                                    }

                                    return items.map(wh => (
                                        <div key={wh.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors group">
                                            <div className="font-medium text-sm text-[#1C2340] flex-1">{wh.name}</div>
                                            
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => { setEditingId(wh.id); setEditName(wh.name); setEditPlatform(selectedPlatform); setIsEditPopupOpen(true); }}
                                                        className="p-1 text-gray-400 hover:text-[#5A5DF6] rounded-full hover:bg-blue-50 transition-colors"
                                                        title="Edit Name & Platform"
                                                    >
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(wh.id, wh.name, selectedPlatform, activeTab)}
                                                            disabled={isActionLoading}
                                                            className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                                                            title="Delete Permanently"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                    <div className="w-px h-4 bg-gray-200"></div>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(wh.is_active)}
                                                        onChange={() => handleToggle(wh.id, wh.is_active, activeTab, selectedPlatform)}
                                                        className="w-4 h-4 text-[#5A5DF6] border-gray-300 rounded focus:ring-[#5A5DF6] cursor-pointer transition-colors"
                                                        title={wh.is_active ? "Deactivate" : "Activate"}
                                                    />
                                                </div>
                                            </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add New Popup Modal */}
            {isAddPopupOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                            <h3 className="text-base font-bold text-[#1C2340]">Add New {activeTab}</h3>
                            <button 
                                onClick={() => setIsAddPopupOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            {addError && (
                                <div className="text-red-500 text-xs font-medium bg-red-50 p-2.5 rounded border border-red-100">
                                    {addError}
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1C2340]">Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder={`e.g. ${activeTab === 'IXD' ? 'IXD_DELHI' : 'DEL6'}`}
                                    className="w-full px-3 py-2 border border-[#D9DDE5] rounded-[5px] text-sm focus:border-[#5A5DF6] focus:ring-1 focus:ring-[#5A5DF6] outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1C2340]">Platform</label>
                                <select
                                    value={newPlatform}
                                    onChange={(e) => setNewPlatform(e.target.value)}
                                    className="w-full px-3 py-2 border border-[#D9DDE5] rounded-[5px] text-sm focus:border-[#5A5DF6] focus:ring-1 focus:ring-[#5A5DF6] outline-none transition-colors capitalize bg-white cursor-pointer"
                                >
                                    <option value="" disabled>Select platform</option>
                                    {allPlatforms.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={() => setIsAddPopupOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-[5px] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveNewWarehouse}
                                    disabled={isAdding}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#5A5DF6] text-white text-sm font-medium rounded-[5px] hover:bg-[#4a4cd6] transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {isAdding ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Popup Modal */}
            {isEditPopupOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                            <h3 className="text-base font-bold text-[#1C2340]">Edit {activeTab}</h3>
                            <button 
                                onClick={() => { setIsEditPopupOpen(false); setEditingId(null); }}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1C2340]">Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 border border-[#D9DDE5] rounded-[5px] text-sm focus:border-[#5A5DF6] focus:ring-1 focus:ring-[#5A5DF6] outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-[#1C2340]">Platform</label>
                                <select
                                    value={editPlatform}
                                    onChange={(e) => setEditPlatform(e.target.value)}
                                    className="w-full px-3 py-2 border border-[#D9DDE5] rounded-[5px] text-sm focus:border-[#5A5DF6] focus:ring-1 focus:ring-[#5A5DF6] outline-none transition-colors capitalize bg-white cursor-pointer"
                                >
                                    <option value="" disabled>Select platform</option>
                                    {allPlatforms.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={() => { setIsEditPopupOpen(false); setEditingId(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-[5px] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleEditSave(editingId, activeTab)}
                                    disabled={isActionLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#5A5DF6] text-white text-sm font-medium rounded-[5px] hover:bg-[#4a4cd6] transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IXDWarehouseModal;
