import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Search, Download, CalendarDays, Truck, Layers, Package,
    Plus, Upload, SlidersHorizontal, X, Loader2, UploadCloud, TrendingDown, TrendingUp, RefreshCcw
} from 'lucide-react';
import api from '../../services/api';

const Calculation = () => {
    // --- States ---
    const [searchTerm, setSearchTerm] = useState("");
    const [calculationData, setCalculationData] = useState([]);
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0, to_ship_qty: 0
    });

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({});

    // Double click cell expand karne ke liye
    const [expandedCell, setExpandedCell] = useState({ rowId: null, colName: null });

    const handleDoubleClick = (rowId, colName) => {
        // Agar same cell par wapas double click kiya, toh band kar do. Nahi toh open kar do.
        if (expandedCell.rowId === rowId && expandedCell.colName === colName) {
            setExpandedCell({ rowId: null, colName: null });
        } else {
            setExpandedCell({ rowId, colName });
        }
    };

    // --- FETCH DATA FROM DATABASE ---
    const fetchCalculationData = async () => {
        try {
            const response = await api.get("/getCalculationData", { params: { _t: Date.now() } });
            if (response.data && response.data.data) {
                // Backend se Master aur Items alag alag aayenge
                if (response.data.data.master) setMasterData(response.data.data.master);
                if (response.data.data.items) setCalculationData(response.data.data.items);
            }
        } catch (error) {
            console.error("Error fetching calculation data:", error);
        }
    };

    // --- EXCEL LIKE AUTO-SAVE FUNCTION ---
    const handleMasterAutoSave = async (field, value) => {
        if (!masterData.id) return; // Agar DB me plan nahi hai to return

        const numValue = parseInt(value) || 0;

        try {
            // Background me chupchap save karega
            await api.put("/update-master", {
                planId: masterData.id,
                field: field,
                value: numValue
            });
            // Optional: console.log("Auto-saved!");
        } catch (error) {
            console.error("Auto-save failed:", error);
            alert("Failed to save value. Please check connection.");
        }
    };

    // --- REAL-TIME AUTO-SAVE FOR FINAL WH ---
    const handleItemAutoSave = async (itemId, val) => {
        try {
            await api.put("/update-item-final-wh", { itemId, finalWh: val });
        } catch (error) {
            console.error("Failed to save item:", error);
        }
    };

    // --- RESET CALCULATIONS BUTTON ---
    const handleResetCalculations = async () => {
        if (!masterData.id) return;
        const confirmReset = window.confirm("Are you sure? This will remove all your manual edits in 'Final WH' and recalculate everything based on the formula.");
        if (!confirmReset) return;

        setIsLoading(true);
        try {
            await api.put("/reset-final-wh", { planId: masterData.id });
            fetchCalculationData(); // Wapas DB se fresh data fetch karega
        } catch (error) {
            alert("Failed to reset. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalculationData();
    }, []);

    // --- API Handlers ---
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert("Pehle ek file select karein!");
        setIsLoading(true);
        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        try {
            const response = await api.post("/upload", uploadData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (response.status === 201 || response.status === 200) {
                alert("Calculation File Uploaded and Processed!");
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                fetchCalculationData();
            }
        } catch (error) {
            alert("Upload failed: " + (error.response?.data?.message || "Server error"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const payload = { ...formData, planId: masterData?.id || 1 };
            const response = await api.post("/manual-add", payload);
            if (response.status === 201 || response.status === 200) {
                alert("SKU Added!");
                setIsAddModalOpen(false);
                fetchCalculationData();
            }
        } catch (error) {
            alert("Submission failed: " + (error.response?.data?.message || "Server error"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Ship-WH aur Int-WH ko real-time recalculate karne ke liye
    // (AFS Days / Shipment Plan Days / Bunch Qty change hote hi turant reflect hoga)
    const displayData = useMemo(() => {
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;
        const bunchQty = Number(masterData.bunch_qty) || 0;
        console.log("bunchQty", bunchQty)

        return calculationData.map((item) => {
            const saleWh = Number(item.sale_wh) || 0;
            const availableQty = Number(item.available_qty) || 0;

            let shipWh = 0;
            if (afsDays > 0) {
                shipWh = Math.ceil(((saleWh / afsDays) * shipmentPlanDays) - availableQty);
            }

            // Formula: =IF(ISNUMBER(ShipWH), IF(ShipWH>=0, IF(ShipWH=0,1, INT(ShipWH/BunchQty)), ""), "")
            let intWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh >= 0) {
                    if (shipWh === 0) {
                        intWh = 1;
                    } else if (bunchQty > 0) {
                        intWh = Math.trunc(shipWh / bunchQty);
                    } else {
                        intWh = "";
                    }
                } else {
                    intWh = "";
                }
            }

            // Formula: =IF(IntWH="","",IF(ShipWH=0,0,ShipWH/BunchQty - IntWH))
            let decWh = "";
            if (intWh !== "") {
                if (shipWh === 0) {
                    decWh = 0;
                } else if (bunchQty > 0) {
                    decWh = (shipWh / bunchQty) - intWh;
                } else {
                    decWh = "";
                }
            }

            // Formula: =IF(ISNUMBER(ShipWH),IF(ShipWH<=0,"",IF(DecWH="","",IntWH*BunchQty+IF(DecWH>0,BunchQty,0))))
            // Formula: =IF(ISNUMBER(ShipWH)... (Aapka purana logic)
            let calculatedFinalWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh <= 0) calculatedFinalWh = "";
                else if (decWh === "") calculatedFinalWh = "";
                else calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
            }

            // 🔥 NAYA LOGIC: Agar manual flag true hai, to Database wali value use karo, warna Formula wali
            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            return {
                ...item,
                ship_wh: shipWh,
                int_wh: intWh,
                dec_wh: decWh,
                final_wh: displayFinalWh // Final column me ye value jayegi
            };
        });
    }, [calculationData, masterData.afs_days, masterData.shipment_plan_days, masterData.bunch_qty]);


    // Filter Logic for Search Bar
    const filteredData = displayData.filter(item =>
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6 relative">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #F4F5F7; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #D9DDE5; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #5A5DF6; }
            `}</style>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#1C2340]">Shipment Calculation</h1>
                    <p className="text-sm text-[#1C2340]/50 mt-0.5">Master sheet for inventory and restock planning</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* UPDATED: Upload Button with Disabled Logic */}
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        disabled={calculationData.length > 0}
                        title={calculationData.length > 0 ? "A calculation plan already exists. Delete the old one from Uploads to add a new file." : "Upload Calculation File"}
                        className={`flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-semibold shadow-sm transition-all
                            ${calculationData.length > 0
                                ? 'opacity-50 cursor-not-allowed text-gray-400'
                                : 'text-[#1C2340] hover:bg-[#F4F5F7]'}`}
                    >
                        <Upload size={14} className={calculationData.length > 0 ? "text-gray-400" : "text-[#5A5DF6]"} />
                        Upload CSV/XLSX
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded-[5px] text-xs font-semibold shadow-sm">
                        <Plus size={14} /> Add New SKU
                    </button>
                    <div className="hidden md:block w-px h-6 bg-[#D9DDE5] mx-1"></div>

                    <button
                        onClick={handleResetCalculations}
                        title="Manually edited Final-WH values ko formula se reset karega"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-semibold text-[#E74C3C] hover:bg-red-50 shadow-sm"
                    >
                        <RefreshCcw size={14} /> Reset Formulas
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] shadow-sm">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            {/* Top Cards (EXCEL-LIKE INLINE EDITING) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Card 1: AFS Days */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-5 flex items-center gap-4 shadow-sm group">
                    <div className="w-11 h-11 rounded-[5px] bg-[#F4F5F7] flex items-center justify-center shrink-0">
                        <CalendarDays size={20} className="text-[#5A5DF6]" />
                    </div>
                    <div>
                        <p className="text-xs text-[#1C2340]/50 font-medium uppercase tracking-wide">AFS Days</p>
                        <input
                            type="number"
                            value={masterData.afs_days || ''}
                            onChange={(e) => {
                                setMasterData({ ...masterData, afs_days: e.target.value });
                                handleMasterAutoSave('afs_days', e.target.value); // 🔥 Real-time save on typing
                            }}
                            className="text-2xl font-bold text-[#1C2340] mt-0.5 bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-24 px-1 py-0 transition-colors -ml-1"
                        />
                    </div>
                </div>

                {/* Card 2: Shipment Plan Days */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-5 flex items-center gap-4 shadow-sm group">
                    <div className="w-11 h-11 rounded-[5px] bg-[#F4F5F7] flex items-center justify-center shrink-0">
                        <Truck size={20} className="text-[#5A5DF6]" />
                    </div>
                    <div className="flex flex-col">
                        <p className="text-xs text-[#1C2340]/50 font-medium uppercase tracking-wide">Shipment Plan</p>
                        <div className="flex items-end mt-0.5">
                            <input
                                type="number"
                                value={masterData.shipment_plan_days || ''}
                                onChange={(e) => {
                                    setMasterData({ ...masterData, shipment_plan_days: e.target.value });
                                    handleMasterAutoSave('shipment_plan_days', e.target.value); // 🔥 Real-time save on typing
                                }}
                                className="text-2xl font-bold text-[#1C2340] bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-20 px-1 py-0 transition-colors -ml-1"
                            />
                            <span className="text-sm font-normal text-[#1C2340]/40 mb-1 ml-1">Days</span>
                        </div>
                    </div>
                </div>

                {/* Card 3: Bunch Qty */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-5 flex items-center gap-4 shadow-sm group">
                    <div className="w-11 h-11 rounded-[5px] bg-[#F4F5F7] flex items-center justify-center shrink-0">
                        <Layers size={20} className="text-[#5A5DF6]" />
                    </div>
                    <div>
                        <p className="text-xs text-[#1C2340]/50 font-medium uppercase tracking-wide">Bunch Qty</p>
                        <input
                            type="number"
                            value={masterData.bunch_qty || ''}
                            onChange={(e) => {
                                setMasterData({ ...masterData, bunch_qty: e.target.value });
                                handleMasterAutoSave('bunch_qty', e.target.value); // 🔥 Real-time save on typing
                            }}
                            className="text-2xl font-bold text-[#1C2340] mt-0.5 bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-24 px-1 py-0 transition-colors -ml-1"
                        />
                    </div>
                </div>

                {/* Card 4: To Ship (Non-editable, calculated later) */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
                    <div className="w-11 h-11 rounded-[5px] bg-[#5A5DF6]/10 flex items-center justify-center shrink-0 relative z-10">
                        <Package size={20} className="text-[#5A5DF6]" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-xs text-[#1C2340]/50 font-medium uppercase tracking-wide">To Ship</p>
                        <h2 className="text-2xl font-bold text-[#1C2340] mt-0.5 px-1 -ml-1">{(masterData.to_ship_qty || 0).toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm flex flex-col min-w-0 overflow-hidden">
                <div className="p-4 border-b border-[#D9DDE5] flex items-center justify-between bg-white rounded-t-[5px]">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1C2340]/40" size={16} />
                        <input type="text" placeholder="Search by SKU or Title..." className="w-full pl-9 pr-4 py-2 text-xs border border-[#D9DDE5] rounded-[4px] focus:outline-none focus:border-[#5A5DF6]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2340]/60 pr-3 border-r border-[#D9DDE5]">
                            <Layers size={14} /> <span>Showing {filteredData.length} SKUs</span>
                        </div>
                        <button className="p-1.5 text-[#1C2340]/60 hover:text-[#5A5DF6] hover:bg-[#5A5DF6]/10 rounded-[4px]"><SlidersHorizontal size={16} /></button>
                    </div>
                </div>

                {/* NAYA UPDATE: overflow-y-auto aur max-h-[60vh] add kiya hai taaki horizontal scrollbar hamesha screen par rahe */}
                <div className="w-full overflow-x-auto overflow-y-auto custom-scrollbar pb-1 min-h-[300px] max-h-[54vh] bg-white">
                    {filteredData.length === 0 ? (
                        <div className="flex justify-center items-center h-full min-h-[300px]">
                            <p className="text-sm text-[#1C2340]/50 font-medium py-10">No data found in database. Please upload a report.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[2500px]">
                            {/* UPDATED: Added bg-white on thead to completely block text leaking through the gap */}
                            <thead className="sticky top-0 z-20 shadow-sm bg-white">
                                {/* Top Row - Grouped Headers */}
                                <tr className="text-[10px] font-bold text-[#1C2340]/60 uppercase tracking-wider border-b border-[#D9DDE5]">
                                    <th className="px-4 py-3 bg-[#F4F5F7]" colSpan="4">Product Identification</th>
                                    <th className="px-4 py-3 bg-blue-50 text-center border-l border-[#D9DDE5]/50" colSpan="3">Initial WH Quantities</th>
                                    <th className="px-4 py-3 bg-purple-50 text-center border-l border-[#D9DDE5]/50" colSpan="8">Variant Breakdown</th>
                                    <th className="px-4 py-3 bg-green-50 text-center border-l border-[#D9DDE5]/50" colSpan="5">Specs & Financials</th>
                                    <th className="px-4 py-3 bg-orange-50 text-center border-l border-[#D9DDE5]/50" colSpan="11">Logistics & Calculation</th>
                                </tr>

                                {/* Bottom Row - Specific Headers */}
                                <tr className="text-[11px] font-semibold text-[#1C2340] border-b-2 border-[#D9DDE5] bg-white relative z-10">
                                    <th className="px-4 py-3 bg-white">Group Name</th>
                                    <th className="px-4 py-3 bg-white">SKU</th>
                                    <th className="px-4 py-3 max-w-[300px] bg-white">Title</th>
                                    <th className="px-4 py-3 bg-white">Category</th>

                                    {/* Initial WH */}
                                    <th className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-blue-50">Int - WH</th>
                                    <th className="px-4 py-3 text-center bg-blue-50">Dec - WH</th>
                                    <th className="px-4 py-3 text-center bg-blue-50">Non Apron Qty</th>

                                    {/* Variant Headers */}
                                    <th className="px-3 py-3 text-center border-l border-[#D9DDE5]/50 bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>Sky Blue</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1E40AF]"></span>Dark Blue</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#92400E]"></span>Brown</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22B573]"></span>Green</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D2B48C]"></span>Tan</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1C2340]"></span>Black</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>Red</div></th>
                                    <th className="px-3 py-3 text-center bg-purple-50"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]"></span>Grey</div></th>

                                    {/* Specs & Financials */}
                                    <th className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-green-50">Weight</th>
                                    <th className="px-4 py-3 text-center bg-green-50">Total Weight</th>
                                    <th className="px-4 py-3 text-center bg-green-50">HSN</th>
                                    <th className="px-4 py-3 text-center bg-green-50">GST</th>
                                    <th className="px-4 py-3 text-center bg-green-50 text-[#22B573] font-bold">COST</th>

                                    {/* Logistics & Calculation */}
                                    <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-orange-50 font-semibold text-[#1C2340]">SKU (Ref)</th>
                                    <th className="px-4 py-3 bg-orange-50 font-semibold text-[#1C2340]">Title (Ref)</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Tra. Qty</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Quantity</th>
                                    <th className="px-4 py-3 text-center bg-orange-50 text-[#5A5DF6] font-bold">Available Qty</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">FC ID</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Sale-Total</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Sale-WH</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Ship - WH</th>
                                    <th className="px-4 py-3 text-center bg-orange-50">Sum</th>
                                    <th className="px-4 py-3 text-center bg-orange-50 font-bold text-[#E74C3C]">Final - WH</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9DDE5]">
                                {filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-[#F4F5F7]/80 transition-colors text-xs text-[#1C2340]/80">
                                        <td className="px-4 py-3 font-semibold text-[#1C2340]">{row.group_name}</td>
                                        <td className="px-4 py-3"><span className="bg-[#F4F5F7] border border-[#D9DDE5] px-2 py-1 rounded-[3px] font-medium">{row.sku}</span></td>
                                        {/* EXCEL LIKE DOUBLE-CLICK EXPAND FOR TITLE */}
                                        <td
                                            onDoubleClick={() => handleDoubleClick(row.id, 'title')}
                                            className={`px-4 py-3 cursor-pointer transition-all duration-300 ${expandedCell.rowId === row.id && expandedCell.colName === 'title'
                                                ? 'whitespace-normal min-w-[300px] break-words bg-white shadow-sm' // Expanded View
                                                : 'max-w-[200px] truncate' // Truncated (Hidden) View
                                                }`}
                                            title="Double click to expand/collapse"
                                        >
                                            {row.title}
                                        </td>
                                        <td className="px-4 py-3">{row.category}</td>

                                        <td className="px-4 py-3 text-center border-l border-[#D9DDE5]/30 font-semibold">{row.int_wh}</td>
                                        <td className="px-4 py-3 text-center">{row.dec_wh}</td>
                                        <td className="px-4 py-3 text-center">{row.non_apron_qty}</td>

                                        {/* Variants Mapping */}
                                        <td className="px-3 py-3 text-center border-l border-[#D9DDE5]/30">{row.apr_sky_blue ? <span className="font-bold text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-[3px]">{row.apr_sky_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_dark_blue ? <span className="font-bold text-[#1E40AF] bg-[#1E40AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_dark_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_brown ? <span className="font-bold text-[#92400E] bg-[#92400E]/10 px-2 py-0.5 rounded-[3px]">{row.apr_brown}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_green ? <span className="font-bold text-[#22B573] bg-[#22B573]/10 px-2 py-0.5 rounded-[3px]">{row.apr_green}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_tan ? <span className="font-bold text-[#D2B48C] bg-[#D2B48C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_tan}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_black ? <span className="font-bold text-[#1C2340] bg-[#1C2340]/10 px-2 py-0.5 rounded-[3px]">{row.apr_black}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_red ? <span className="font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_red}</span> : <span className="text-[#1C2340]/30">-</span>}</td>
                                        <td className="px-3 py-3 text-center">{row.apr_grey ? <span className="font-bold text-[#9CA3AF] bg-[#9CA3AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_grey}</span> : <span className="text-[#1C2340]/30">-</span>}</td>

                                        <td className="px-4 py-3 text-center border-l border-[#D9DDE5]/30">{row.weight}</td>
                                        <td className="px-4 py-3 text-center">{row.total_weight}</td>
                                        <td className="px-4 py-3 text-center">{row.hsn || '-'}</td>
                                        <td className="px-4 py-3 text-center">{row.gst || '-'}</td>
                                        <td className="px-4 py-3 text-center font-bold text-[#22B573]">₹{row.cost}</td>

                                        {/* EXCEL LIKE DOUBLE-CLICK EXPAND FOR REF SKU & TITLE */}
                                        <td className="px-4 py-3 border-l border-[#D9DDE5]/30 text-xs text-[#1C2340]/80 font-medium">
                                            {row.ref_sku}
                                        </td>

                                        <td
                                            onDoubleClick={() => handleDoubleClick(row.id, 'ref_title')}
                                            className={`px-4 py-3 text-xs text-[#1C2340]/80 font-medium cursor-pointer transition-all duration-300 ${expandedCell.rowId === row.id && expandedCell.colName === 'ref_title'
                                                ? 'whitespace-normal min-w-[300px] break-words bg-white shadow-sm'
                                                : 'max-w-[200px] truncate'
                                                }`}
                                            title="Double click to expand"
                                        >
                                            {row.ref_title}
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-[#5A5DF6]">{row.tra_qty}</td>
                                        <td className="px-4 py-3 text-center">{row.quantity}</td>
                                        <td className="px-4 py-3 text-center font-bold text-[#1C2340] bg-[#F4F5F7]/50">{row.available_qty}</td>
                                        <td className="px-4 py-3 text-center"><span className="bg-[#D9DDE5]/40 px-2 py-0.5 rounded-[3px] text-[10px]">{row.fulfilment_id}</span></td>
                                        <td className="px-4 py-3 text-center">{row.sale_total}</td>
                                        <td className="px-4 py-3 text-center">{row.sale_wh}</td>
                                        <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                                            {row.ship_wh < 0 ? <TrendingDown size={12} className="text-[#E74C3C]" /> : <TrendingUp size={12} className="text-[#22B573]" />}
                                            <span className={row.ship_wh < 0 ? "text-[#E74C3C] font-semibold" : ""}>{row.ship_wh}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">{row.sum_val}</td>
                                        {/* 🔥 INLINE EDIT FOR FINAL WH 🔥 */}
                                        <td className="px-4 py-3 text-center bg-orange-50/30">
                                            <input
                                                type="number"
                                                value={row.final_wh === "" ? "" : row.final_wh}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    // UI ko turant update karne ke liye state set karein
                                                    setCalculationData(prev => prev.map(p =>
                                                        p.id === row.id ? { ...p, final_wh: val, is_manual_final_wh: 1 } : p
                                                    ));
                                                    // Background me DB update karein
                                                    handleItemAutoSave(row.id, val);
                                                }}
                                                className={`w-16 text-center font-bold bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none transition-colors
                                                        ${row.is_manual_final_wh ? 'text-[#5A5DF6]' : 'text-[#1C2340]'}`}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modals Code from previous version remains exactly the same below... */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1C2340]/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[8px] shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between">
                            <h3 className="font-bold text-[#1C2340]">Upload Calculation Report</h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleFileUpload} className="p-6 space-y-5">
                            <div
                                className="border-2 border-dashed border-[#D9DDE5] rounded-[5px] bg-[#F4F5F7]/30 hover:bg-[#F4F5F7]/80 p-8 flex flex-col items-center justify-center cursor-pointer transition-colors"
                                onClick={() => fileInputRef.current.click()}
                            >
                                <input type="file" accept=".csv, .xlsx" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} />
                                <div className="w-12 h-12 rounded-full bg-[#5A5DF6]/10 flex items-center justify-center mb-3"><UploadCloud size={24} className="text-[#5A5DF6]" /></div>
                                <h3 className="text-sm font-bold text-[#1C2340] mb-1">Upload File</h3>
                                {selectedFile ? (
                                    <div className="text-center">
                                        <p className="text-[#5A5DF6] text-xs font-semibold max-w-[200px] truncate">{selectedFile.name}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-[#1C2340]/50 text-center">Click to browse CSV or Excel</p>
                                )}
                            </div>
                            <button type="submit" disabled={isLoading || !selectedFile} className="w-full bg-[#5A5DF6] text-white py-2.5 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#494ce0] disabled:opacity-70">
                                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : "Upload & Process"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. MANUAL ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1C2340]/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[8px] shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between shrink-0">
                            <h3 className="font-bold text-[#1C2340]">Add New SKU Details</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <form id="add-sku-form" onSubmit={handleManualSubmit} className="space-y-6">
                                {/* Section 1: Basic Info */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div><label className="text-xs text-gray-600">Group Name *</label><input type="text" name="groupName" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="APR- Black" /></div>
                                        <div><label className="text-xs text-gray-600">SKU *</label><input type="text" name="sku" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Apron_Black" /></div>
                                        <div><label className="text-xs text-gray-600">Category</label><input type="text" name="category" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" /></div>
                                        <div className="md:col-span-3"><label className="text-xs text-gray-600">Title</label><input type="text" name="title" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" /></div>
                                    </div>
                                </div>

                                {/* Section 2: WH & Financials */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Warehouse & Financials</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div><label className="text-xs text-gray-600">Int WH</label><input type="number" name="intWh" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" defaultValue="0" /></div>
                                        <div><label className="text-xs text-gray-600">Cost (₹)</label><input type="number" name="cost" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" defaultValue="0" /></div>
                                        <div><label className="text-xs text-gray-600">Quantity</label><input type="number" name="quantity" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" defaultValue="0" /></div>
                                        <div><label className="text-xs text-gray-600">Weight (g)</label><input type="number" name="weight" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" defaultValue="0" /></div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-[#D9DDE5] flex items-center justify-end gap-3 shrink-0 bg-gray-50 rounded-b-[8px]">
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-[5px] transition-colors">Cancel</button>
                            <button type="submit" form="add-sku-form" disabled={isLoading} className="px-5 py-2 bg-[#5A5DF6] text-white text-sm font-bold rounded-[5px] hover:bg-[#494ce0] flex items-center gap-2 transition-all disabled:opacity-70">
                                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save SKU"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calculation;
