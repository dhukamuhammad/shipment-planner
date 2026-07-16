import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Download, CalendarDays, Truck, Layers, Package,
    Plus, Upload, SlidersHorizontal, X, Loader2, UploadCloud,
    TrendingDown, TrendingUp, RefreshCcw, ChevronLeft, ChevronRight,
    Pencil, Trash2, Check, X as CloseIcon
} from 'lucide-react';
import api from '../../services/api';

const Calculation = () => {
    const navigate = useNavigate();
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

    const [collapsedGroups, setCollapsedGroups] = useState(() => {
        try {
            const saved = localStorage.getItem('calc_collapsedGroups');
            return saved ? JSON.parse(saved) : {
                product: false, initialWH: false, variants: false, specs: false, logistics: false
            };
        } catch {
            return { product: false, initialWH: false, variants: false, specs: false, logistics: false };
        }
    });

    // collapsedGroups change hote hi localStorage me save karo
    useEffect(() => {
        localStorage.setItem('calc_collapsedGroups', JSON.stringify(collapsedGroups));
    }, [collapsedGroups]);

    const toggleGroup = (group) => {
        setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

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

    // 🔥 NAYE STATES: Modal Edit & Delete ke liye
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({});

    // --- ROW DELETE HANDLER ---
    const handleDeleteRow = async (itemId) => {
        if (!window.confirm("Are you sure you want to delete this SKU?")) return;
        try {
            await api.delete(`/delete-row/${itemId}`);
            setCalculationData(prev => prev.filter(row => row.id !== itemId));
        } catch (error) {
            alert("Failed to delete row.");
        }
    };
    // --- MODAL EDIT HANDLERS ---
    const startEditing = (row) => {
        setEditFormData({
            id: row.id,
            groupName: row.group_name, sku: row.sku, title: row.title,
            category: row.category, hsn: row.hsn, gst: row.gst, cost: row.cost,
            weight: row.weight // 🔥 Naya add kiya
        });
        setIsEditModalOpen(true);
    };

    const handleEditInputChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.put("/edit-row", { itemId: editFormData.id, ...editFormData });
            // UI instantly update karo
            setCalculationData(prev => prev.map(row => row.id === editFormData.id ? {
                ...row,
                group_name: editFormData.groupName, sku: editFormData.sku,
                title: editFormData.title, category: editFormData.category,
                hsn: editFormData.hsn, gst: editFormData.gst, cost: editFormData.cost,
                weight: editFormData.weight, // 🔥 Naya add kiya
                ref_sku: editFormData.sku, ref_title: editFormData.title
            } : row));
            setIsEditModalOpen(false);
        } catch (error) {
            alert("Failed to save edits.");
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

    // Number input par mouse scroll se value change hone se rokne ke liye
    const handleWheelBlur = (e) => {
        e.target.blur();
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

            // Formula: =IF(FinalWH="","",FinalWH*Weight)
            let totalWeight = "";
            if (displayFinalWh !== "" && displayFinalWh !== null && displayFinalWh !== undefined) {
                const weight = Number(item.weight) || 0;
                totalWeight = Number(displayFinalWh) * weight;
            }

            return {
                ...item,
                ship_wh: shipWh,
                int_wh: intWh,
                dec_wh: decWh,
                final_wh: displayFinalWh, // Final column me ye value jayegi
                total_weight: totalWeight
            };
        });
    }, [calculationData, masterData.afs_days, masterData.shipment_plan_days, masterData.bunch_qty]);

    const totalToShip = React.useMemo(() => {
        return displayData.reduce((total, item) => {
            const val = Number(item.final_wh);
            return total + (isNaN(val) ? 0 : val); // Agar blank ("") ya text hai, toh 0 count karega
        }, 0);
    }, [displayData]);


    // Filter Logic for Search Bar
    const filteredData = displayData.filter(item =>
        (item.group_name && item.group_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const closedCount = Object.values(collapsedGroups).filter(Boolean).length;
    // Agar 2 ya usse zyada group close hain, to font bada karo
    const isSpacious = closedCount >= 2;
    const activeText = isSpacious ? "text-sm" : "text-xs";
    const activeHead = isSpacious ? "text-xs" : "text-[10px]";
    const activeSubHead = isSpacious ? "text-xs" : "text-[11px]";

    const defaultColWidths = {
        group_name: 120, sku: 120, title: 250, category: 100,
        int_wh: 90, dec_wh: 90, non_apron_qty: 110,
        sky_blue: 85, dark_blue: 85, brown: 85, green: 85, tan: 85, black: 85, red: 85, grey: 85,
        weight: 80, total_weight: 110, hsn: 80, gst: 70, cost: 80,
        ref_sku: 130, ref_title: 200, tra_qty: 85, quantity: 85, available_qty: 110,
        fc_id: 75, sale_total: 95, sale_wh: 95, ship_wh: 95, sum_val: 75, final_wh: 95
    };

    const colWidthsRef = useRef((() => {
        try {
            const saved = localStorage.getItem('calc_colWidths');
            return saved ? { ...defaultColWidths, ...JSON.parse(saved) } : { ...defaultColWidths };
        } catch {
            return { ...defaultColWidths };
        }
    })());

    const colRefs = useRef({});

    const tableRef = useRef(null);

    const calculateTotalTableWidth = () => {
        const w = colWidthsRef.current;
        let total = 80; // Action column base width

        if (productSpan > 0) total += collapsedGroups.product ? 40 : ((visibleColumns.group_name ? w.group_name : 0) + (visibleColumns.sku ? w.sku : 0) + (visibleColumns.title ? w.title : 0) + (visibleColumns.category ? w.category : 0));
        if (initWHSpan > 0) total += collapsedGroups.initialWH ? 40 : ((visibleColumns.int_wh ? w.int_wh : 0) + (visibleColumns.dec_wh ? w.dec_wh : 0) + (visibleColumns.non_apron_qty ? w.non_apron_qty : 0));
        if (variantsSpan > 0) total += collapsedGroups.variants ? 40 : ((visibleColumns.sky_blue ? w.sky_blue : 0) + (visibleColumns.dark_blue ? w.dark_blue : 0) + (visibleColumns.brown ? w.brown : 0) + (visibleColumns.green ? w.green : 0) + (visibleColumns.tan ? w.tan : 0) + (visibleColumns.black ? w.black : 0) + (visibleColumns.red ? w.red : 0) + (visibleColumns.grey ? w.grey : 0));
        if (specsSpan > 0) total += collapsedGroups.specs ? 40 : ((visibleColumns.weight ? w.weight : 0) + (visibleColumns.total_weight ? w.total_weight : 0) + (visibleColumns.hsn ? w.hsn : 0) + (visibleColumns.gst ? w.gst : 0) + (visibleColumns.cost ? w.cost : 0));
        if (logisticsSpan > 0) total += collapsedGroups.logistics ? 40 : ((visibleColumns.ref_sku ? w.ref_sku : 0) + (visibleColumns.ref_title ? w.ref_title : 0) + (visibleColumns.tra_qty ? w.tra_qty : 0) + (visibleColumns.quantity ? w.quantity : 0) + (visibleColumns.available_qty ? w.available_qty : 0) + (visibleColumns.fc_id ? w.fc_id : 0) + (visibleColumns.sale_total ? w.sale_total : 0) + (visibleColumns.sale_wh ? w.sale_wh : 0) + (visibleColumns.ship_wh ? w.ship_wh : 0) + (visibleColumns.sum_val ? w.sum_val : 0) + (visibleColumns.final_wh ? w.final_wh : 0));

        return total;
    };

    // 🔥 EXCEL-LIKE COLUMN RESIZE ENGINE — <col> aur table dono ki width update karega (real shrink, no redistribution)
    const handleResizeMouseDown = (colName) => (e) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = colWidthsRef.current[colName];
        const colEl = colRefs.current[colName];

        const handleMouseMove = (moveEvent) => {
            const newWidth = Math.max(20, startWidth + (moveEvent.pageX - startX)); // 20px minimum, Excel jaisa
            if (colEl) {
                colEl.style.width = `${newWidth}px`;
            }
            colWidthsRef.current[colName] = newWidth;

            // Table ki total width ko bhi sync karo, taaki freed space doosre columns me na phaile
            if (tableRef.current) {
                tableRef.current.style.width = `${calculateTotalTableWidth()}px`;
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Resize khatam hote hi naya width localStorage me save karo
            localStorage.setItem('calc_colWidths', JSON.stringify(colWidthsRef.current));
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };


    // 🔥 NAYE STATES: Column Visibility Modal ke liye
    const [isColumnFilterOpen, setIsColumnFilterOpen] = useState(false);
    const defaultVisibleColumns = {
        group_name: true, sku: true, title: true, category: true,
        int_wh: true, dec_wh: true, non_apron_qty: true,
        sky_blue: true, dark_blue: true, brown: true, green: true, tan: true, black: true, red: true, grey: true,
        weight: true, total_weight: true, hsn: true, gst: true, cost: true,
        ref_sku: true, ref_title: true, tra_qty: true, quantity: true, available_qty: true, fc_id: true, sale_total: true, sale_wh: true, ship_wh: true, sum_val: true, final_wh: true
    };

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('calc_visibleColumns');
            return saved ? { ...defaultVisibleColumns, ...JSON.parse(saved) } : { ...defaultVisibleColumns };
        } catch {
            return { ...defaultVisibleColumns };
        }
    });

    // visibleColumns change hote hi localStorage me save karo
    useEffect(() => {
        localStorage.setItem('calc_visibleColumns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    const handleColumnToggle = (colKey) => {
        setVisibleColumns(prev => ({ ...prev, [colKey]: !prev[colKey] }));
    };

    // Helper: Dynamic ColSpan count karne ke liye (Agar columns hide ki gayi hain)
    const getColSpan = (cols) => cols.filter(c => visibleColumns[c]).length;
    const productSpan = getColSpan(['group_name', 'sku', 'title', 'category']);
    const initWHSpan = getColSpan(['int_wh', 'dec_wh', 'non_apron_qty']);
    const variantsSpan = getColSpan(['sky_blue', 'dark_blue', 'brown', 'green', 'tan', 'black', 'red', 'grey']);
    const specsSpan = getColSpan(['weight', 'total_weight', 'hsn', 'gst', 'cost']);
    const logisticsSpan = getColSpan(['ref_sku', 'ref_title', 'tra_qty', 'quantity', 'available_qty', 'fc_id', 'sale_total', 'sale_wh', 'ship_wh', 'sum_val', 'final_wh']);

    // 🔥 NAYA: Group Checkbox Toggle Logic
    const colGroupsConfig = {
        product: ['group_name', 'sku', 'title', 'category'],
        initialWH: ['int_wh', 'dec_wh', 'non_apron_qty'],
        variants: ['sky_blue', 'dark_blue', 'brown', 'green', 'tan', 'black', 'red', 'grey'],
        specs: ['weight', 'total_weight', 'hsn', 'gst', 'cost'],
        logistics: ['ref_sku', 'ref_title', 'tra_qty', 'quantity', 'available_qty', 'fc_id', 'sale_total', 'sale_wh', 'ship_wh', 'sum_val', 'final_wh']
    };

    const handleGroupToggle = (groupKey, isChecked) => {
        const keys = colGroupsConfig[groupKey];
        setVisibleColumns(prev => {
            const newState = { ...prev };
            keys.forEach(k => newState[k] = isChecked);
            return newState;
        });
    };





    return (
        <div className="space-y-3 relative pb-2">
            {/* COMPACT HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                    <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Shipment Calculation</h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleResetCalculations}
                        title="Manually edited Final-WH values ko formula se reset karega"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-semibold text-[#E74C3C] hover:bg-red-50 shadow-sm"
                    >
                        <RefreshCcw size={12} /> Reset Formulas
                    </button>
                    <button onClick={() => setIsUploadModalOpen(true)} disabled={calculationData.length > 0} title={calculationData.length > 0 ? "Delete old plan to upload new" : "Upload File"} className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D9DDE5] rounded-[4px] text-[11px] font-semibold shadow-sm transition-all ${calculationData.length > 0 ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-[#1C2340] hover:bg-[#F4F5F7]'}`}>
                        <Upload size={12} className={calculationData.length > 0 ? "text-gray-400" : "text-[#5A5DF6]"} /> Upload
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded-[4px] text-[11px] font-semibold shadow-sm">
                        <Plus size={12} /> Add SKU
                    </button>
                    <div className="hidden md:block w-px h-4 bg-[#D9DDE5] mx-0.5"></div>
                    <button
                        onClick={() => {
                            // Sirf wo SKUs bhejo jinka Final-WH value 0 se zyada hai
                            const manifestSkus = filteredData
                                .filter(item => Number(item.final_wh) > 0)
                                .map(item => ({
                                    sku: item.sku,
                                    quantity: item.final_wh,
                                    fc: item.fulfilment_id,
                                    hsn_sac_code: item.hsn,
                                    gst_rate: item.gst,
                                    declared_value_per_unit: item.cost
                                }));
                            navigate('/manifest', { state: { manifestSkus } });
                        }}
                        title="Final-WH wale SKUs ka manifest banayein"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D9DDE5] rounded-[4px] text-[11px] font-semibold text-[#1C2340] hover:bg-[#F4F5F7] shadow-sm"
                    >
                        <Package size={12} /> Generate Manifest
                    </button>
                </div>
            </div>

            {/* SLIM SINGLE-ROW SETTINGS STRIP (Table ke liye zyada space free karne ke liye) */}
            <div className="bg-white border border-[#D9DDE5] rounded-[5px] px-4 py-2 flex items-center gap-6 shadow-sm flex-wrap">
                <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-[#5A5DF6]" />
                    <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">AFS Days</span>
                    <input
                        type="number"
                        value={masterData.afs_days || ''}
                        onChange={(e) => {
                            setMasterData({ ...masterData, afs_days: e.target.value });
                            handleMasterAutoSave('afs_days', e.target.value);
                        }}
                        onWheel={handleWheelBlur}
                        className="text-sm font-bold text-[#1C2340] bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-12 px-0.5 py-0 transition-colors"
                    />
                </div>

                <div className="w-px h-5 bg-[#D9DDE5]"></div>

                <div className="flex items-center gap-2">
                    <Truck size={14} className="text-[#5A5DF6]" />
                    <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">Shipment Plan</span>
                    <input
                        type="number"
                        value={masterData.shipment_plan_days || ''}
                        onChange={(e) => {
                            setMasterData({ ...masterData, shipment_plan_days: e.target.value });
                            handleMasterAutoSave('shipment_plan_days', e.target.value);
                        }}
                        onWheel={handleWheelBlur}
                        className="text-sm font-bold text-[#1C2340] bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-12 px-0.5 py-0 transition-colors"
                    />
                    <span className="text-[10px] font-semibold text-[#1C2340]/40">Days</span>
                </div>

                <div className="w-px h-5 bg-[#D9DDE5]"></div>

                <div className="flex items-center gap-2">
                    <Layers size={14} className="text-[#5A5DF6]" />
                    <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">Bunch Qty</span>
                    <input
                        type="number"
                        value={masterData.bunch_qty || ''}
                        onChange={(e) => {
                            setMasterData({ ...masterData, bunch_qty: e.target.value });
                            handleMasterAutoSave('bunch_qty', e.target.value);
                        }}
                        onWheel={handleWheelBlur}
                        className="text-sm font-bold text-[#1C2340] bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none w-12 px-0.5 py-0 transition-colors"
                    />
                </div>

                <div className="w-px h-5 bg-[#D9DDE5]"></div>

                <div className="flex items-center gap-2 ml-auto bg-[#5A5DF6]/10 px-3 py-1 rounded-[4px]">
                    <Package size={14} className="text-[#5A5DF6]" />
                    <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">To Ship</span>
                    <span className="text-sm font-bold text-[#1C2340]">{totalToShip.toLocaleString()}</span>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm flex flex-col min-w-0 overflow-hidden">

                {/* COMPACT TABLE TOOLBAR (Updated with Filter Click Handler) */}
                <div className="px-3 py-2 border-b border-[#D9DDE5] flex items-center justify-between bg-[#F9FAFB] rounded-t-[5px]">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1C2340]/40" size={14} />
                        <input type="text" placeholder="Search by SKU or Title..." className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-[#D9DDE5] rounded-[4px] focus:outline-none focus:border-[#5A5DF6]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1C2340]/60 pr-3 border-r border-[#D9DDE5]">
                            <Layers size={12} /> <span>{filteredData.length} SKUs</span>
                        </div>
                        {/* 🔥 Filter Modal Trigger Button */}
                        <button onClick={() => setIsColumnFilterOpen(true)} className="p-1 text-[#1C2340]/60 hover:text-[#5A5DF6] hover:bg-[#5A5DF6]/10 rounded-[3px] transition-colors"><SlidersHorizontal size={14} /></button>
                    </div>
                </div>

                {/* 🔥 COMPLETE EXCEL-STYLE TABLE WITH FILTER & ACTIONS 🔥 */}
                <div className="w-full overflow-x-auto overflow-y-auto custom-scrollbar min-h-[300px] max-h-[79vh] bg-white">
                    {filteredData.length === 0 ? (
                        <div className="flex justify-center items-center h-full min-h-[300px]">
                            <p className="text-sm text-[#1C2340]/50 font-medium py-10">No data found in database. Please upload a report.</p>
                        </div>
                    ) : (
                        <table ref={typeof tableRef !== 'undefined' ? tableRef : null} className="text-left whitespace-nowrap" style={typeof calculateTotalTableWidth === 'function' ? { width: calculateTotalTableWidth() } : { minWidth: "2500px" }}>

                            {/* 🔥 COLGROUP */}
                            <colgroup>
                                <col style={{ width: 64 }} />

                                {productSpan > 0 && (collapsedGroups.product ? <col style={{ width: 40 }} /> : <>
                                    {visibleColumns.group_name && <col ref={el => colRefs.current.group_name = el} style={{ width: colWidthsRef.current.group_name }} />}
                                    {visibleColumns.sku && <col ref={el => colRefs.current.sku = el} style={{ width: colWidthsRef.current.sku }} />}
                                    {visibleColumns.title && <col ref={el => colRefs.current.title = el} style={{ width: colWidthsRef.current.title }} />}
                                    {visibleColumns.category && <col ref={el => colRefs.current.category = el} style={{ width: colWidthsRef.current.category }} />}
                                </>)}

                                {initWHSpan > 0 && (collapsedGroups.initialWH ? <col style={{ width: 40 }} /> : <>
                                    {visibleColumns.int_wh && <col ref={el => colRefs.current.int_wh = el} style={{ width: colWidthsRef.current.int_wh }} />}
                                    {visibleColumns.dec_wh && <col ref={el => colRefs.current.dec_wh = el} style={{ width: colWidthsRef.current.dec_wh }} />}
                                    {visibleColumns.non_apron_qty && <col ref={el => colRefs.current.non_apron_qty = el} style={{ width: colWidthsRef.current.non_apron_qty }} />}
                                </>)}

                                {variantsSpan > 0 && (collapsedGroups.variants ? <col style={{ width: 40 }} /> : <>
                                    {visibleColumns.sky_blue && <col ref={el => colRefs.current.sky_blue = el} style={{ width: colWidthsRef.current.sky_blue }} />}
                                    {visibleColumns.dark_blue && <col ref={el => colRefs.current.dark_blue = el} style={{ width: colWidthsRef.current.dark_blue }} />}
                                    {visibleColumns.brown && <col ref={el => colRefs.current.brown = el} style={{ width: colWidthsRef.current.brown }} />}
                                    {visibleColumns.green && <col ref={el => colRefs.current.green = el} style={{ width: colWidthsRef.current.green }} />}
                                    {visibleColumns.tan && <col ref={el => colRefs.current.tan = el} style={{ width: colWidthsRef.current.tan }} />}
                                    {visibleColumns.black && <col ref={el => colRefs.current.black = el} style={{ width: colWidthsRef.current.black }} />}
                                    {visibleColumns.red && <col ref={el => colRefs.current.red = el} style={{ width: colWidthsRef.current.red }} />}
                                    {visibleColumns.grey && <col ref={el => colRefs.current.grey = el} style={{ width: colWidthsRef.current.grey }} />}
                                </>)}

                                {specsSpan > 0 && (collapsedGroups.specs ? <col style={{ width: 40 }} /> : <>
                                    {visibleColumns.weight && <col ref={el => colRefs.current.weight = el} style={{ width: colWidthsRef.current.weight }} />}
                                    {visibleColumns.total_weight && <col ref={el => colRefs.current.total_weight = el} style={{ width: colWidthsRef.current.total_weight }} />}
                                    {visibleColumns.hsn && <col ref={el => colRefs.current.hsn = el} style={{ width: colWidthsRef.current.hsn }} />}
                                    {visibleColumns.gst && <col ref={el => colRefs.current.gst = el} style={{ width: colWidthsRef.current.gst }} />}
                                    {visibleColumns.cost && <col ref={el => colRefs.current.cost = el} style={{ width: colWidthsRef.current.cost }} />}
                                </>)}

                                {logisticsSpan > 0 && (collapsedGroups.logistics ? <col style={{ width: 40 }} /> : <>
                                    {visibleColumns.ref_sku && <col ref={el => colRefs.current.ref_sku = el} style={{ width: colWidthsRef.current.ref_sku }} />}
                                    {visibleColumns.ref_title && <col ref={el => colRefs.current.ref_title = el} style={{ width: colWidthsRef.current.ref_title }} />}
                                    {visibleColumns.tra_qty && <col ref={el => colRefs.current.tra_qty = el} style={{ width: colWidthsRef.current.tra_qty }} />}
                                    {visibleColumns.quantity && <col ref={el => colRefs.current.quantity = el} style={{ width: colWidthsRef.current.quantity }} />}
                                    {visibleColumns.available_qty && <col ref={el => colRefs.current.available_qty = el} style={{ width: colWidthsRef.current.available_qty }} />}
                                    {visibleColumns.fc_id && <col ref={el => colRefs.current.fc_id = el} style={{ width: colWidthsRef.current.fc_id }} />}
                                    {visibleColumns.sale_total && <col ref={el => colRefs.current.sale_total = el} style={{ width: colWidthsRef.current.sale_total }} />}
                                    {visibleColumns.sale_wh && <col ref={el => colRefs.current.sale_wh = el} style={{ width: colWidthsRef.current.sale_wh }} />}
                                    {visibleColumns.ship_wh && <col ref={el => colRefs.current.ship_wh = el} style={{ width: colWidthsRef.current.ship_wh }} />}
                                    {visibleColumns.sum_val && <col ref={el => colRefs.current.sum_val = el} style={{ width: colWidthsRef.current.sum_val }} />}
                                    {visibleColumns.final_wh && <col ref={el => colRefs.current.final_wh = el} style={{ width: colWidthsRef.current.final_wh }} />}
                                </>)}
                            </colgroup>

                            {/* SMART THEAD */}
                            <thead className="sticky top-0 z-20 shadow-sm bg-white">
                                {/* Top Row - Grouped Headers */}
                                <tr className={`${typeof activeHead !== 'undefined' ? activeHead : 'text-[10px]'} font-bold text-[#1C2340]/60 uppercase tracking-wider border-b border-[#D9DDE5]`}>
                                    <th rowSpan={2} className="w-16 px-2 py-3 bg-[#1C2340]/5 border-r-2 border-[#D9DDE5] align-bottom text-center text-[#1C2340]/50">• • •</th>

                                    {productSpan > 0 && (collapsedGroups.product ? (
                                        <th rowSpan={2} className="w-6 py-2 bg-[#F4F5F7] border-r border-b-2 border-[#D9DDE5] align-top">
                                            <div className="flex flex-col items-center gap-1.5"><button onClick={() => toggleGroup('product')} className="p-0.5 hover:bg-black/10 rounded"><ChevronRight size={12} /></button><span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PRODUCT</span></div>
                                        </th>
                                    ) : (
                                        <th className="px-4 py-3 bg-[#F4F5F7]" colSpan={productSpan}>
                                            <div className="flex items-center justify-between"><span>Product Identification</span><button onClick={() => toggleGroup('product')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button></div>
                                        </th>
                                    ))}

                                    {initWHSpan > 0 && (collapsedGroups.initialWH ? (
                                        <th rowSpan={2} className="w-6 py-2 bg-blue-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                                            <div className="flex flex-col items-center gap-1.5"><button onClick={() => toggleGroup('initialWH')} className="p-0.5 hover:bg-black/10 rounded"><ChevronRight size={12} /></button><span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>INITIAL WH</span></div>
                                        </th>
                                    ) : (
                                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-blue-50" colSpan={initWHSpan}>
                                            <div className="flex items-center justify-between"><span>Initial WH Quantities</span><button onClick={() => toggleGroup('initialWH')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button></div>
                                        </th>
                                    ))}

                                    {variantsSpan > 0 && (collapsedGroups.variants ? (
                                        <th rowSpan={2} className="w-6 py-2 bg-purple-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                                            <div className="flex flex-col items-center gap-1.5"><button onClick={() => toggleGroup('variants')} className="p-0.5 hover:bg-black/10 rounded"><ChevronRight size={12} /></button><span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>VARIANTS</span></div>
                                        </th>
                                    ) : (
                                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-purple-50" colSpan={variantsSpan}>
                                            <div className="flex items-center justify-between"><span>Variant Breakdown</span><button onClick={() => toggleGroup('variants')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button></div>
                                        </th>
                                    ))}

                                    {specsSpan > 0 && (collapsedGroups.specs ? (
                                        <th rowSpan={2} className="w-6 py-2 bg-green-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                                            <div className="flex flex-col items-center gap-1.5"><button onClick={() => toggleGroup('specs')} className="p-0.5 hover:bg-black/10 rounded"><ChevronRight size={12} /></button><span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>SPECS</span></div>
                                        </th>
                                    ) : (
                                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-green-50" colSpan={specsSpan}>
                                            <div className="flex items-center justify-between"><span>Specs & Financials</span><button onClick={() => toggleGroup('specs')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button></div>
                                        </th>
                                    ))}

                                    {logisticsSpan > 0 && (collapsedGroups.logistics ? (
                                        <th rowSpan={2} className="w-6 py-2 bg-orange-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                                            <div className="flex flex-col items-center gap-1.5"><button onClick={() => toggleGroup('logistics')} className="p-0.5 hover:bg-black/10 rounded"><ChevronRight size={12} /></button><span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>LOGISTICS</span></div>
                                        </th>
                                    ) : (
                                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-orange-50" colSpan={logisticsSpan}>
                                            <div className="flex items-center justify-between"><span>Logistics & Calculation</span><button onClick={() => toggleGroup('logistics')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button></div>
                                        </th>
                                    ))}
                                </tr>

                                {/* Bottom Row - Specific Headers */}
                                <tr className={`${typeof activeSubHead !== 'undefined' ? activeSubHead : 'text-[11px]'} font-semibold text-[#1C2340] border-b-2 border-[#D9DDE5] bg-white relative z-10`}>
                                    {productSpan > 0 && !collapsedGroups.product && (
                                        <>
                                            {visibleColumns.group_name && <th style={{ width: colWidthsRef.current.group_name, minWidth: colWidthsRef.current.group_name }} className="px-4 py-3 bg-white relative group">Group Name<div onMouseDown={handleResizeMouseDown('group_name')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                                            {visibleColumns.sku && <th style={{ width: colWidthsRef.current.sku, minWidth: colWidthsRef.current.sku }} className="px-4 py-3 bg-white relative group">SKU<div onMouseDown={handleResizeMouseDown('sku')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                                            {visibleColumns.title && <th style={{ width: colWidthsRef.current.title, minWidth: colWidthsRef.current.title, maxWidth: colWidthsRef.current.title }} className="px-4 py-3 bg-white relative group">Title<div onMouseDown={handleResizeMouseDown('title')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                                            {visibleColumns.category && <th style={{ width: colWidthsRef.current.category, minWidth: colWidthsRef.current.category }} className="px-4 py-3 bg-white relative group">Category<div onMouseDown={handleResizeMouseDown('category')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                                        </>
                                    )}

                                    {initWHSpan > 0 && !collapsedGroups.initialWH && (
                                        <>
                                            {visibleColumns.int_wh && <th style={{ width: colWidthsRef.current.int_wh, minWidth: colWidthsRef.current.int_wh }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-blue-50 relative group">Int - WH<div onMouseDown={handleResizeMouseDown('int_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.dec_wh && <th style={{ width: colWidthsRef.current.dec_wh, minWidth: colWidthsRef.current.dec_wh }} className="px-4 py-3 text-center bg-blue-50 relative group">Dec - WH<div onMouseDown={handleResizeMouseDown('dec_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.non_apron_qty && <th style={{ width: colWidthsRef.current.non_apron_qty, minWidth: colWidthsRef.current.non_apron_qty }} className="px-4 py-3 text-center bg-blue-50 relative group">Non Apron Qty<div onMouseDown={handleResizeMouseDown('non_apron_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                                        </>
                                    )}

                                    {variantsSpan > 0 && !collapsedGroups.variants && (
                                        <>
                                            {visibleColumns.sky_blue && <th style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/50 bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>Sky Blue</div><div onMouseDown={handleResizeMouseDown('sky_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.dark_blue && <th style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1E40AF]"></span>Dark Blue</div><div onMouseDown={handleResizeMouseDown('dark_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.brown && <th style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#92400E]"></span>Brown</div><div onMouseDown={handleResizeMouseDown('brown')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.green && <th style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22B573]"></span>Green</div><div onMouseDown={handleResizeMouseDown('green')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.tan && <th style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D2B48C]"></span>Tan</div><div onMouseDown={handleResizeMouseDown('tan')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.black && <th style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1C2340]"></span>Black</div><div onMouseDown={handleResizeMouseDown('black')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.red && <th style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>Red</div><div onMouseDown={handleResizeMouseDown('red')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.grey && <th style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]"></span>Grey</div><div onMouseDown={handleResizeMouseDown('grey')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                        </>
                                    )}

                                    {specsSpan > 0 && !collapsedGroups.specs && (
                                        <>
                                            {visibleColumns.weight && <th style={{ width: colWidthsRef.current.weight, minWidth: colWidthsRef.current.weight }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-green-50 relative group">Weight<div onMouseDown={handleResizeMouseDown('weight')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.total_weight && <th style={{ width: colWidthsRef.current.total_weight, minWidth: colWidthsRef.current.total_weight }} className="px-4 py-3 text-center bg-green-50 relative group">Total Weight<div onMouseDown={handleResizeMouseDown('total_weight')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.hsn && <th style={{ width: colWidthsRef.current.hsn, minWidth: colWidthsRef.current.hsn }} className="px-4 py-3 text-center bg-green-50 relative group">HSN<div onMouseDown={handleResizeMouseDown('hsn')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.gst && <th style={{ width: colWidthsRef.current.gst, minWidth: colWidthsRef.current.gst }} className="px-4 py-3 text-center bg-green-50 relative group">GST<div onMouseDown={handleResizeMouseDown('gst')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.cost && <th style={{ width: colWidthsRef.current.cost, minWidth: colWidthsRef.current.cost }} className="px-4 py-3 text-center bg-green-50 text-[#22B573] font-bold relative group">COST<div onMouseDown={handleResizeMouseDown('cost')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                        </>
                                    )}

                                    {logisticsSpan > 0 && !collapsedGroups.logistics && (
                                        <>
                                            {visibleColumns.ref_sku && <th style={{ width: colWidthsRef.current.ref_sku, minWidth: colWidthsRef.current.ref_sku }} className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-orange-50 font-semibold text-[#1C2340] relative group">SKU (Ref)<div onMouseDown={handleResizeMouseDown('ref_sku')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.ref_title && <th style={{ width: colWidthsRef.current.ref_title, minWidth: colWidthsRef.current.ref_title, maxWidth: colWidthsRef.current.ref_title }} className="px-4 py-3 bg-orange-50 font-semibold text-[#1C2340] relative group">Title (Ref)<div onMouseDown={handleResizeMouseDown('ref_title')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.tra_qty && <th style={{ width: colWidthsRef.current.tra_qty, minWidth: colWidthsRef.current.tra_qty }} className="px-4 py-3 text-center bg-orange-50 relative group">Tra. Qty<div onMouseDown={handleResizeMouseDown('tra_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.quantity && <th style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3 text-center bg-orange-50 relative group">Quantity<div onMouseDown={handleResizeMouseDown('quantity')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.available_qty && <th style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3 text-center bg-orange-50 text-[#5A5DF6] font-bold relative group">Available Qty<div onMouseDown={handleResizeMouseDown('available_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.fc_id && <th style={{ width: colWidthsRef.current.fc_id, minWidth: colWidthsRef.current.fc_id }} className="px-4 py-3 text-center bg-orange-50 relative group">FC ID<div onMouseDown={handleResizeMouseDown('fc_id')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.sale_total && <th style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-Total<div onMouseDown={handleResizeMouseDown('sale_total')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.sale_wh && <th style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-WH<div onMouseDown={handleResizeMouseDown('sale_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.ship_wh && <th style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Ship - WH<div onMouseDown={handleResizeMouseDown('ship_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.sum_val && <th style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center bg-orange-50 relative group">Sum<div onMouseDown={handleResizeMouseDown('sum_val')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                            {visibleColumns.final_wh && <th style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className="px-4 py-3 text-center bg-orange-50 font-bold text-[#E74C3C] relative group">Final - WH<div onMouseDown={handleResizeMouseDown('final_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                                        </>
                                    )}
                                </tr>
                            </thead>

                            <tbody className="bg-white">
                                {filteredData.map((row) => {
                                    const liveAfsDays = Number(masterData.afs_days) || 0;
                                    const livePlanDays = Number(masterData.shipment_plan_days) || 0;

                                    let liveShipWh = 0;
                                    if (liveAfsDays > 0) {
                                        liveShipWh = Math.ceil(((row.sale_wh / liveAfsDays) * livePlanDays) - row.available_qty);
                                    }
                                    const liveTotalWeight = row.final_wh !== "" ? (Number(row.final_wh) || 0) * (Number(row.weight) || 0) : "";

                                    return (
                                        <tr key={row.id} className={`group hover:bg-[#F4F5F7]/80 transition-colors text-[#1C2340]/80 ${typeof activeText !== 'undefined' ? activeText : 'text-xs'}`}>

                                            {/* Action Column Cell */}
                                            <td className="w-16 px-2 py-3 text-center bg-white border-r-2 border-[#D9DDE5]">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditing(row)} title="Edit SKU" className="p-1 text-[#5A5DF6] hover:bg-[#5A5DF6]/10 rounded transition-colors"><Pencil size={13} /></button>
                                                    <button onClick={() => handleDeleteRow(row.id)} title="Delete Row" className="p-1 text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded transition-colors"><Trash2 size={13} /></button>
                                                </div>
                                            </td>

                                            {/* 1. Product Cells */}
                                            {productSpan > 0 && (collapsedGroups.product ? (
                                                <td className="bg-[#F4F5F7]/40 border-r border-[#D9DDE5]/40"></td>
                                            ) : (
                                                <>
                                                    {visibleColumns.group_name && <td style={{ width: colWidthsRef.current.group_name, minWidth: colWidthsRef.current.group_name }} className="px-4 py-3 font-semibold text-[#1C2340]">{row.group_name}</td>}
                                                    {visibleColumns.sku && <td style={{ width: colWidthsRef.current.sku, minWidth: colWidthsRef.current.sku }} className="px-4 py-3"><span className="bg-[#F4F5F7] border border-[#D9DDE5] px-2 py-1 rounded-[3px] font-medium">{row.sku}</span></td>}
                                                    {visibleColumns.title && <td onDoubleClick={() => handleDoubleClick(row.id, 'title')} style={{ width: colWidthsRef.current.title, minWidth: colWidthsRef.current.title, maxWidth: colWidthsRef.current.title }} className={`px-4 py-3 cursor-pointer transition-all duration-300 ${expandedCell?.rowId === row.id && expandedCell?.colName === 'title' ? 'whitespace-normal break-words bg-white shadow-sm' : 'truncate'}`} title="Double click to expand">{row.title}</td>}
                                                    {visibleColumns.category && <td style={{ width: colWidthsRef.current.category, minWidth: colWidthsRef.current.category }} className="px-4 py-3">{row.category}</td>}
                                                </>
                                            ))}

                                            {/* 2. Initial WH Cells */}
                                            {initWHSpan > 0 && (collapsedGroups.initialWH ? (
                                                <td className="bg-blue-50/20 border-r border-[#D9DDE5]/40"></td>
                                            ) : (
                                                <>
                                                    {visibleColumns.int_wh && <td style={{ width: colWidthsRef.current.int_wh, minWidth: colWidthsRef.current.int_wh }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/30 font-semibold">{row.int_wh}</td>}
                                                    {visibleColumns.dec_wh && <td style={{ width: colWidthsRef.current.dec_wh, minWidth: colWidthsRef.current.dec_wh }} className="px-4 py-3 text-center">{row.dec_wh}</td>}
                                                    {visibleColumns.non_apron_qty && <td style={{ width: colWidthsRef.current.non_apron_qty, minWidth: colWidthsRef.current.non_apron_qty }} className="px-4 py-3 text-center">{row.non_apron_qty}</td>}
                                                </>
                                            ))}

                                            {/* 3. Variants Cells */}
                                            {variantsSpan > 0 && (collapsedGroups.variants ? (
                                                <td className="bg-purple-50/20 border-r border-[#D9DDE5]/40"></td>
                                            ) : (
                                                <>
                                                    {visibleColumns.sky_blue && <td style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/30">{row.apr_sky_blue ? <span className="font-bold text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-[3px]">{row.apr_sky_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.dark_blue && <td style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center">{row.apr_dark_blue ? <span className="font-bold text-[#1E40AF] bg-[#1E40AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_dark_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.brown && <td style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center">{row.apr_brown ? <span className="font-bold text-[#92400E] bg-[#92400E]/10 px-2 py-0.5 rounded-[3px]">{row.apr_brown}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.green && <td style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center">{row.apr_green ? <span className="font-bold text-[#22B573] bg-[#22B573]/10 px-2 py-0.5 rounded-[3px]">{row.apr_green}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.tan && <td style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center">{row.apr_tan ? <span className="font-bold text-[#D2B48C] bg-[#D2B48C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_tan}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.black && <td style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center">{row.apr_black ? <span className="font-bold text-[#1C2340] bg-[#1C2340]/10 px-2 py-0.5 rounded-[3px]">{row.apr_black}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.red && <td style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center">{row.apr_red ? <span className="font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_red}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                    {visibleColumns.grey && <td style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center">{row.apr_grey ? <span className="font-bold text-[#9CA3AF] bg-[#9CA3AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_grey}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                </>
                                            ))}

                                            {/* 4. Specs & Financials Cells */}
                                            {specsSpan > 0 && (collapsedGroups.specs ? (
                                                <td className="bg-green-50/20 border-r border-[#D9DDE5]/40"></td>
                                            ) : (
                                                <>
                                                    {visibleColumns.weight && <td style={{ width: colWidthsRef.current.weight, minWidth: colWidthsRef.current.weight }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/30">{row.weight}</td>}
                                                    {visibleColumns.total_weight && <td style={{ width: colWidthsRef.current.total_weight, minWidth: colWidthsRef.current.total_weight }} className="px-4 py-3 text-center font-medium">{liveTotalWeight !== "" ? Number(liveTotalWeight).toFixed(2) : "-"}</td>}
                                                    {visibleColumns.hsn && <td style={{ width: colWidthsRef.current.hsn, minWidth: colWidthsRef.current.hsn }} className="px-4 py-3 text-center">{row.hsn || '-'}</td>}
                                                    {visibleColumns.gst && <td style={{ width: colWidthsRef.current.gst, minWidth: colWidthsRef.current.gst }} className="px-4 py-3 text-center">{row.gst || '-'}</td>}
                                                    {visibleColumns.cost && <td style={{ width: colWidthsRef.current.cost, minWidth: colWidthsRef.current.cost }} className="px-4 py-3 text-center font-bold text-[#22B573]">₹{row.cost}</td>}
                                                </>
                                            ))}

                                            {/* 5. Logistics Cells */}
                                            {logisticsSpan > 0 && (collapsedGroups.logistics ? (
                                                <td className="bg-orange-50/20 border-r border-[#D9DDE5]/40"></td>
                                            ) : (
                                                <>
                                                    {visibleColumns.ref_sku && <td style={{ width: colWidthsRef.current.ref_sku, minWidth: colWidthsRef.current.ref_sku }} className="px-4 py-3 border-l border-[#D9DDE5]/30 font-medium truncate">{row.ref_sku}</td>}
                                                    {visibleColumns.ref_title && <td onDoubleClick={() => handleDoubleClick(row.id, 'ref_title')} style={{ width: colWidthsRef.current.ref_title, minWidth: colWidthsRef.current.ref_title, maxWidth: colWidthsRef.current.ref_title }} className={`px-4 py-3 font-medium cursor-pointer transition-all duration-300 ${expandedCell?.rowId === row.id && expandedCell?.colName === 'ref_title' ? 'whitespace-normal break-words bg-white shadow-sm' : 'truncate'}`} title="Double click to expand">{row.ref_title}</td>}
                                                    {visibleColumns.tra_qty && <td style={{ width: colWidthsRef.current.tra_qty, minWidth: colWidthsRef.current.tra_qty }} className="px-4 py-3 text-center font-semibold text-[#5A5DF6]">{row.tra_qty}</td>}
                                                    {visibleColumns.quantity && <td style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3 text-center">{row.quantity}</td>}
                                                    {visibleColumns.available_qty && <td style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3 text-center font-bold text-[#1C2340] bg-[#F4F5F7]/50">{row.available_qty}</td>}
                                                    {visibleColumns.fc_id && <td style={{ width: colWidthsRef.current.fc_id, minWidth: colWidthsRef.current.fc_id }} className="px-4 py-3 text-center"><span className="bg-[#D9DDE5]/40 px-2 py-0.5 rounded-[3px] text-[10px]">{row.fulfilment_id}</span></td>}
                                                    {visibleColumns.sale_total && <td style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center">{row.sale_total}</td>}
                                                    {visibleColumns.sale_wh && <td style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center">{row.sale_wh}</td>}
                                                    {visibleColumns.ship_wh && <td style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center flex items-center justify-center gap-1">{liveShipWh < 0 ? <TrendingDown size={12} className="text-[#E74C3C]" /> : <TrendingUp size={12} className="text-[#22B573]" />}<span className={liveShipWh < 0 ? "text-[#E74C3C] font-semibold" : ""}>{liveShipWh}</span></td>}
                                                    {visibleColumns.sum_val && <td style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center">{row.sum_val}</td>}
                                                    {visibleColumns.final_wh && <td style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className="px-4 py-3 text-center bg-orange-50/30">
                                                        <input type="number" value={row.final_wh === "" ? "" : row.final_wh} onChange={(e) => { const val = e.target.value; setCalculationData(prev => prev.map(p => p.id === row.id ? { ...p, final_wh: val, is_manual_final_wh: 1 } : p)); handleItemAutoSave(row.id, val); }} onWheel={handleWheelBlur} className="w-14 text-center font-bold bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none transition-colors" style={{ color: row.is_manual_final_wh ? '#5A5DF6' : '#1C2340' }} />
                                                    </td>}
                                                </>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>)}
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
                            {/* 🔥 UPDATED ADD SKU FORM 🔥 */}
                            <form id="add-sku-form" onSubmit={handleManualSubmit} className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product & Financial Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-600">Group Name *</label>
                                            <input type="text" name="groupName" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. APR- Black" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">SKU *</label>
                                            <input type="text" name="sku" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. Apron_Black" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-600">Title</label>
                                            <input type="text" name="title" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Full Product Title..." />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Category</label>
                                            <input type="text" name="category" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. Apron" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">HSN</label>
                                            <input type="text" name="hsn" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. 6302" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">GST</label>
                                            <input type="text" name="gst" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. 5%" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Cost (₹)</label>
                                            <input type="number" step="0.01" name="cost" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="0.00" />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-600">Weight (kg/g)</label>
                                            <input type="number" step="0.01" name="weight" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. 0.5" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-4 italic">* FC ID will automatically be set to 'BLR4'. Other quantities will be initialized to 0.</p>
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

            {/* 🔥 EDIT SKU MODAL 🔥 */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-[#F4F5F7]">
                            <h3 className="font-bold text-[#1C2340] text-lg">Edit SKU Details</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                                <CloseIcon size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="edit-sku-form" onSubmit={handleEditSubmit} className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product & Financial Info</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-600">Group Name *</label>
                                            <input type="text" name="groupName" value={editFormData.groupName || ''} required onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">SKU *</label>
                                            <input type="text" name="sku" value={editFormData.sku || ''} required onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-xs text-gray-600">Title</label>
                                            <input type="text" name="title" value={editFormData.title || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Category</label>
                                            <input type="text" name="category" value={editFormData.category || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">HSN</label>
                                            <input type="text" name="hsn" value={editFormData.hsn || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">GST</label>
                                            <input type="text" name="gst" value={editFormData.gst || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Cost (₹)</label>
                                            <input type="number" step="0.01" name="cost" value={editFormData.cost || 0} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-600">Weight (kg/g)</label>
                                            <input type="number" step="0.01" name="weight" value={editFormData.weight || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
                            <button type="submit" form="edit-sku-form" className="px-4 py-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded text-sm font-medium transition-colors">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 COLUMN VISIBILITY FILTER MODAL 🔥 */}
            {isColumnFilterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[8px] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-200">
                        <div className="px-5 py-4 border-b border-[#D9DDE5] flex justify-between items-center bg-[#F9FAFB]">
                            <h3 className="font-bold text-[#1C2340] text-sm flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-[#5A5DF6]" />
                                Customize Columns
                            </h3>
                            <button onClick={() => setIsColumnFilterOpen(false)} className="text-[#1C2340]/40 hover:text-[#E74C3C] transition-colors">
                                <CloseIcon size={18} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 bg-white">
                            <div>
                                <label className="flex items-center gap-2 mb-3 pb-1 border-b border-[#D9DDE5]/50 cursor-pointer group">
                                    <input type="checkbox" checked={productSpan === colGroupsConfig.product.length} onChange={(e) => handleGroupToggle('product', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Product</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['group_name', 'Group Name'], ['sku', 'SKU'], ['title', 'Title'], ['category', 'Category']].map(([k, l]) => (
                                        <label key={k} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={visibleColumns[k]} onChange={() => handleColumnToggle(k)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                            <span className="text-[11px] font-medium text-[#1C2340]/80 group-hover:text-[#5A5DF6] transition-colors">{l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 mb-3 pb-1 border-b border-[#D9DDE5]/50 cursor-pointer group">
                                    <input type="checkbox" checked={initWHSpan === colGroupsConfig.initialWH.length} onChange={(e) => handleGroupToggle('initialWH', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Initial WH</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['int_wh', 'Int - WH'], ['dec_wh', 'Dec - WH'], ['non_apron_qty', 'Non Apron Qty']].map(([k, l]) => (
                                        <label key={k} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={visibleColumns[k]} onChange={() => handleColumnToggle(k)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                            <span className="text-[11px] font-medium text-[#1C2340]/80 group-hover:text-[#5A5DF6] transition-colors">{l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 mb-3 pb-1 border-b border-[#D9DDE5]/50 cursor-pointer group">
                                    <input type="checkbox" checked={variantsSpan === colGroupsConfig.variants.length} onChange={(e) => handleGroupToggle('variants', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Variants</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['sky_blue', 'Sky Blue'], ['dark_blue', 'Dark Blue'], ['brown', 'Brown'], ['green', 'Green'], ['tan', 'Tan'], ['black', 'Black'], ['red', 'Red'], ['grey', 'Grey']].map(([k, l]) => (
                                        <label key={k} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={visibleColumns[k]} onChange={() => handleColumnToggle(k)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                            <span className="text-[11px] font-medium text-[#1C2340]/80 group-hover:text-[#5A5DF6] transition-colors">{l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 mb-3 pb-1 border-b border-[#D9DDE5]/50 cursor-pointer group">
                                    <input type="checkbox" checked={specsSpan === colGroupsConfig.specs.length} onChange={(e) => handleGroupToggle('specs', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Specs & Fin</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['weight', 'Weight'], ['total_weight', 'Total Weight'], ['hsn', 'HSN'], ['gst', 'GST'], ['cost', 'Cost']].map(([k, l]) => (
                                        <label key={k} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={visibleColumns[k]} onChange={() => handleColumnToggle(k)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                            <span className="text-[11px] font-medium text-[#1C2340]/80 group-hover:text-[#5A5DF6] transition-colors">{l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 mb-3 pb-1 border-b border-[#D9DDE5]/50 cursor-pointer group">
                                    <input type="checkbox" checked={logisticsSpan === colGroupsConfig.logistics.length} onChange={(e) => handleGroupToggle('logistics', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Logistics</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['ref_sku', 'SKU (Ref)'], ['ref_title', 'Title (Ref)'], ['tra_qty', 'Tra. Qty'], ['quantity', 'Quantity'], ['available_qty', 'Available Qty'], ['fc_id', 'FC ID'], ['sale_total', 'Sale-Total'], ['sale_wh', 'Sale-WH'], ['ship_wh', 'Ship-WH'], ['sum_val', 'Sum'], ['final_wh', 'Final-WH']].map(([k, l]) => (
                                        <label key={k} className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={visibleColumns[k]} onChange={() => handleColumnToggle(k)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                            <span className="text-[11px] font-medium text-[#1C2340]/80 group-hover:text-[#5A5DF6] transition-colors">{l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 border-t border-[#D9DDE5] bg-[#F9FAFB] flex justify-end gap-3">
                            <button onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {}))} className="px-4 py-1.5 border border-[#D9DDE5] text-[#1C2340]/80 rounded-[4px] text-xs font-semibold hover:bg-white transition-colors">Select All</button>
                            <button onClick={() => setIsColumnFilterOpen(false)} className="px-5 py-1.5 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded-[4px] text-xs font-bold shadow-sm transition-colors">Apply Details</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calculation;
