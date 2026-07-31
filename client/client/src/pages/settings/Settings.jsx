import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Settings as SettingsIcon, Save, Loader2, AlertCircle, Box } from 'lucide-react';
import EventCalendar from './EventCalendar';
import IXDWarehouseModal from './IXDWarehouseModal';

const Settings = () => {
    const [useSuggestedWh, setUseSuggestedWh] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch settings on load
    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                const response = await api.get('/settings');
                if (response.data?.success && response.data?.data) {
                    setUseSuggestedWh(response.data.data.use_suggested_wh === '1');
                }
            } catch (err) {
                console.error("Failed to load settings", err);
                setError("Failed to load settings from server.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Save setting when toggled
    const handleToggle = async () => {
        const newValue = !useSuggestedWh;
        setUseSuggestedWh(newValue);
        setIsSaving(true);
        setError(null);

        try {
            await api.post('/settings', {
                setting_key: 'use_suggested_wh',
                setting_value: newValue ? '1' : '0'
            });
        } catch (err) {
            console.error("Failed to save setting", err);
            setError("Failed to save setting. It will revert on reload.");
            setUseSuggestedWh(!newValue); // revert on fail
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-[#D9DDE5] pb-4">
                <div className="p-2 bg-[#5A5DF6]/10 rounded-[5px]">
                    <SettingsIcon size={20} className="text-[#5A5DF6]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#1C2340]">Settings</h1>
                    <p className="text-sm text-[#1C2340]/60">Manage application preferences and feature flags</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[5px] flex items-center gap-2 text-sm font-medium">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                    <h2 className="text-base font-bold text-[#1C2340]">Shipment Manifest Preferences</h2>
                    {isLoading && <Loader2 size={16} className="text-[#5A5DF6] animate-spin" />}
                </div>
                
                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="max-w-xl">
                            <h3 className="text-sm font-bold text-[#1C2340] mb-1">Use "Suggest Final-WH" for Shipment Plan</h3>
                            <p className="text-xs text-[#1C2340]/60 leading-relaxed">
                                If enabled, the Manifest Generation will use the calculated <strong>Sugg Final-WH</strong> column instead of the default <strong>Final-WH</strong> column. This will also update the UI highlighting in the Calculation table.
                            </p>
                        </div>
                        
                        <div className="ml-6 flex items-center gap-3">
                            {isSaving && <Loader2 size={14} className="text-[#5A5DF6] animate-spin" />}
                            <button
                                onClick={handleToggle}
                                disabled={isLoading}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                                    useSuggestedWh ? 'bg-[#22B573]' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        useSuggestedWh ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Event Calendar for Shipment Multiplier */}
            <EventCalendar />

            {/* IXD & Warehouse Settings Button */}
            <div className="bg-white border border-[#D9DDE5] rounded-[8px] overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-[#D9DDE5] bg-gray-50 flex justify-between items-center">
                    <h2 className="text-base font-bold text-[#1C2340]">Platform Warehouses</h2>
                </div>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="max-w-xl">
                            <h3 className="text-sm font-bold text-[#1C2340] mb-1">Manage IXD & Warehouse</h3>
                            <p className="text-xs text-[#1C2340]/60 leading-relaxed">
                                View and manage which IXD and Warehouse locations are active for each platform. Data is extracted from the uploaded Excel Calculation Reports.
                            </p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            <Box size={16} className="text-[#5A5DF6]" />
                            Open Settings
                        </button>
                    </div>
                </div>
            </div>

            <IXDWarehouseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
};

export default Settings;