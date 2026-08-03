import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Search, Download, CalendarDays, Truck, Layers, Package,
    Plus, Upload, SlidersHorizontal, X, Loader2, UploadCloud,
    TrendingDown, TrendingUp, RefreshCcw, ChevronLeft, ChevronRight,
    Pencil, Trash2, Check, X as CloseIcon, MoreVertical, ChevronDown, Bell, BellRing, FileText, Scan, Eye, EyeOff, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import MarketplaceDropdown from '../../components/MarketplaceDropdown';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';

const formatFnskuTitle = (title) => {
    if (!title) return '';
    if (title.length <= 30) return title;
    const start = title.slice(0, 12);
    const end = title.slice(-18);
    return `${start} ... ${end}`;
};

const extractMultiplier = (sku, title) => {
    const s = (sku || '').toLowerCase();
    const t = (title || '').toLowerCase();
    const patterns = [
        /pack\s*of\s*(\d+)/,
        /set\s*of\s*(\d+)/,
        /combo\s*of\s*(\d+)/,
        /(\d+)\s*pack/,
        /(\d+)\s*pcs/,
        /(\d+)\s*pieces/,
        /(\d+)\s*q\b/,
        /x\s*(\d+)$/,
        /\(\s*(\d+)\s*(?:pack|set|pcs)\s*\)/
    ];
    for (let p of patterns) {
        let match = s.match(p);
        if (match && match[1]) return parseInt(match[1], 10);
    }
    for (let p of patterns) {
        let match = t.match(p);
        if (match && match[1]) return parseInt(match[1], 10);
    }
    return 1;
};

const Calculation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const urlPlanId = searchParams.get('planId');
    const urlMarketplaceId = searchParams.get('marketplace_id');
    // --- States ---
    const [searchTerm, setSearchTerm] = useState("");
    const [calculationData, setCalculationData] = useState([]);
    const [useSuggestedWh, setUseSuggestedWh] = useState(false);
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0, to_ship_qty: 0
    });

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const hasAutoLoaded = useRef(false);
    const [showMissingOnly, setShowMissingOnly] = useState(false);

    // --- Event Notification States ---
    const [activeEventNotifications, setActiveEventNotifications] = useState([]);

    // Marketplace & History filter state
    const getInitialMarketplace = () => {
        if (urlMarketplaceId) {
            localStorage.setItem('active_calc_marketplace', urlMarketplaceId);
            return urlMarketplaceId;
        }
        return localStorage.getItem('active_calc_marketplace') || "";
    };

    const [selectedMarketplaceId, setSelectedMarketplaceId] = useState("");
    const [filterMarketplaceId, setFilterMarketplaceId] = useState(getInitialMarketplace);

    const handleMarketplaceChange = (id) => {
        setFilterMarketplaceId(id);
        if (id) {
            localStorage.setItem('active_calc_marketplace', id);
        } else {
            localStorage.removeItem('active_calc_marketplace');
        }
    };
    const getInitialPlanId = () => {
        if (urlPlanId) {
            localStorage.setItem('active_calc_plan_id', urlPlanId);
            return urlPlanId;
        }
        return localStorage.getItem('active_calc_plan_id') || "";
    };

    const [historyPlans, setHistoryPlans] = useState([]);
    const [selectedHistoryPlanId, setSelectedHistoryPlanId] = useState(getInitialPlanId);

    const handlePlanChange = (id) => {
        setSelectedHistoryPlanId(id);
        if (id) {
            localStorage.setItem('active_calc_plan_id', id);
        } else {
            localStorage.removeItem('active_calc_plan_id');
        }
    };

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

    const [expandedRows, setExpandedRows] = useState({});
    const toggleRowExpand = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };
    const shipmentMode = localStorage.getItem('shipment_mode') || 'IXD';

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
            const urlAutoLoad = searchParams.get('auto_load') === 'true';
            const canAutoLoad = urlAutoLoad && !hasAutoLoaded.current;

            // Agar koi marketplace select nahi kiya gaya hai, aur URL me planId bhi nahi hai, 
            // toh default (global latest) plan fetch mat karo. UI ko blank rakho.
            if (!filterMarketplaceId && !urlPlanId) {
                setMasterData({});
                setCalculationData([]);
                setIsLoading(false);
                return;
            }

            // Agar user ne history dropdown se koi plan select NAHI kiya hai (matlab just marketplace select kiya hai ya default state hai),
            // aur URL me koi specific plan nahi hai, aur "auto_load" param nahi hai...
            // TOH data fetch mat karo. Page ko blank rakho jab tak user specific history select na kare.
            if (filterMarketplaceId && !selectedHistoryPlanId && !urlPlanId && !canAutoLoad) {
                setMasterData({});
                setCalculationData([]);
                setIsLoading(false);
                return;
            }

            if (canAutoLoad) {
                hasAutoLoaded.current = true;
            }

            const params = { _t: Date.now() };
            if (urlPlanId) params.planId = urlPlanId;
            else if (selectedHistoryPlanId) params.planId = selectedHistoryPlanId;

            if (filterMarketplaceId) params.marketplace_id = filterMarketplaceId;
            params.shipment_mode = localStorage.getItem('shipment_mode') || 'IXD';

            const response = await api.get("/getCalculationData", { params });
            if (response.data && response.data.data) {
                // Backend se Master aur Items alag alag aayenge
                if (response.data.data.master) {
                    setMasterData(response.data.data.master);

                    // RE-FETCH HISTORY TO SYNC DROPDOWN
                    if (filterMarketplaceId) {
                        try {
                            const historyRes = await api.get('/history', { params: { marketplace_id: filterMarketplaceId } });
                            if (historyRes.data?.success) {
                                setHistoryPlans(historyRes.data.data);
                                // Select the newly created plan in the dropdown
                                if (canAutoLoad) {
                                    handlePlanChange(response.data.data.master.id);
                                }
                            }
                        } catch (e) {
                            console.error("Failed to sync history", e);
                        }
                    }
                } else {
                    setMasterData({});
                }
                const fetchedItems = response.data.data.items || [];
                const parsedItems = fetchedItems.map(item => {
                    let parsedFcBreakdown = item.fc_breakdown;
                    if (typeof parsedFcBreakdown === 'string') {
                        try {
                            parsedFcBreakdown = JSON.parse(parsedFcBreakdown);
                        } catch (e) { }
                    }
                    return { ...item, fc_breakdown: parsedFcBreakdown };
                });
                setCalculationData(parsedItems);
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error fetching calculation data:", error);
            setIsLoading(false);
        }

        try {
            const settingsRes = await api.get("/settings");
            if (settingsRes.data?.success && settingsRes.data?.data) {
                setUseSuggestedWh(settingsRes.data.data.use_suggested_wh === '1');
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    // --- EVENT NOTIFICATIONS LOGIC ---
    const fetchAndCheckEventNotifications = async () => {
        try {
            const res = await api.get('/events');
            if (!res.data?.success) return;
            const events = res.data.data;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const toShow = events.filter(event => {
                // Already accepted? skip
                const accepted = localStorage.getItem(`event_accepted_${event.id}`);
                if (accepted === 'true') return false;

                // Remind later? check 12-hour window
                const remindAt = localStorage.getItem(`event_remind_later_${event.id}`);
                if (remindAt) {
                    const remindTime = new Date(parseInt(remindAt, 10));
                    const twelveHoursLater = new Date(remindTime.getTime() + 12 * 60 * 60 * 1000);
                    if (new Date() < twelveHoursLater) return false;
                }

                // Calculate remind start date
                const startDate = new Date(event.start_date);
                startDate.setHours(0, 0, 0, 0);
                const remindValue = parseInt(event.remind_before_value) || 3;
                const remindUnit = event.remind_before_unit || 'days';

                let remindStartDate = new Date(startDate);
                if (remindUnit === 'months') {
                    remindStartDate.setMonth(remindStartDate.getMonth() - remindValue);
                } else {
                    remindStartDate.setDate(remindStartDate.getDate() - remindValue);
                }
                remindStartDate.setHours(0, 0, 0, 0);

                // Show only within [remindStartDate, startDate]
                return today >= remindStartDate && today <= startDate;
            }).map(event => {
                const startDate = new Date(event.start_date);
                startDate.setHours(0, 0, 0, 0);
                const today2 = new Date();
                today2.setHours(0, 0, 0, 0);
                const daysLeft = Math.ceil((startDate - today2) / (1000 * 60 * 60 * 24));
                return { ...event, daysLeft };
            });

            setActiveEventNotifications(toShow);
        } catch (err) {
            console.error('Failed to fetch event notifications', err);
        }
    };

    const handleEventAccept = async (event) => {
        if (!masterData?.id) return;
        try {
            const mult = parseFloat(event.multiplier) || 1;

            // Use frontend's displayData (dynamically calculated) — NOT stale DB values
            const items = displayData
                .filter(row => row.suggest_final_wh !== '' && row.suggest_final_wh !== null && row.suggest_final_wh !== undefined && !isNaN(Number(row.suggest_final_wh)))
                .map(row => ({
                    id: row.id,
                    newSuggestFinalWh: Math.ceil(Number(row.suggest_final_wh) * mult)
                }));

            if (items.length > 0) {
                await api.put('/apply-event-multiplier', { items });
            }

            // Enable Sugg Final WH mode
            await api.post('/settings', { setting_key: 'use_suggested_wh', setting_value: '1' });
            setUseSuggestedWh(true);
            localStorage.setItem(`event_accepted_${event.id}`, 'true');
            setActiveEventNotifications(prev => prev.filter(e => e.id !== event.id));
            // Refresh data to show updated values
            fetchCalculationData();
        } catch (err) {
            console.error('Failed to accept event', err);
        }
    };

    const handleEventRemindLater = (eventId) => {
        localStorage.setItem(`event_remind_later_${eventId}`, Date.now().toString());
        setActiveEventNotifications(prev => prev.filter(e => e.id !== eventId));
    };

    useEffect(() => {
        fetchAndCheckEventNotifications();
    }, []);

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

    // --- REAL-TIME AUTO-SAVE FOR FC FINAL WH ---
    const handleFcFinalWhSubmit = async (itemId, fc, val) => {
        try {
            await api.put("/update-item-final-wh", { itemId, finalWh: val, fc });
            setEditFormData(null);
            fetchCalculationData(); // Refresh the list to get recalculated data
        } catch (error) {
            console.error("Failed to save FC item:", error);
        }
    };

    // --- REAL-TIME AUTO-SAVE FOR SUGGEST WH ---
    const handleSuggestAutoSave = async (itemId, val) => {
        try {
            await api.put("/update-item-suggest-wh", { itemId, suggestWh: val });
        } catch (error) {
            console.error("Failed to save suggest wh:", error);
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

    // --- Barcode States ---
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [barcodeData, setBarcodeData] = useState(null);
    const barcodePrintRef = useRef(null);
    const [barcodeType, setBarcodeType] = useState('product'); // 'product' or 'fnsku'
    const [showBarcodePreview, setShowBarcodePreview] = useState(true);
    const [productBarcodeSize, setProductBarcodeSize] = useState({ width: 50, height: 25 });
    const [fnskuBarcodeSize, setFnskuBarcodeSize] = useState({ width: 50, height: 25 });

    useEffect(() => {
        const savedProduct = localStorage.getItem('productBarcodeDimensions');
        if (savedProduct) {
            try { setProductBarcodeSize(JSON.parse(savedProduct)); } catch (e) { }
        }
        const savedFnsku = localStorage.getItem('fnskuBarcodeDimensions');
        if (savedFnsku) {
            try { setFnskuBarcodeSize(JSON.parse(savedFnsku)); } catch (e) { }
        }
    }, []);

    const activeBarcodeSize = barcodeType === 'product' ? productBarcodeSize : fnskuBarcodeSize;

    const handleBarcodeSizeChange = (e, field) => {
        const val = e.target.value;
        const newDim = val === '' ? '' : (parseInt(val) || 0);

        if (barcodeType === 'product') {
            const newSize = { ...productBarcodeSize, [field]: newDim };
            setProductBarcodeSize(newSize);
            localStorage.setItem('productBarcodeDimensions', JSON.stringify(newSize));
        } else {
            const newSize = { ...fnskuBarcodeSize, [field]: newDim };
            setFnskuBarcodeSize(newSize);
            localStorage.setItem('fnskuBarcodeDimensions', JSON.stringify(newSize));
        }
    };

    const handlePrintBarcode = useReactToPrint({
        contentRef: barcodePrintRef,
        documentTitle: 'Barcode',
    });

    // --- All Barcode & Download States ---
    const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
    const downloadDropdownRef = useRef(null);
    const [isAllBarcodeModalOpen, setIsAllBarcodeModalOpen] = useState(false);
    const allBarcodePrintRef = useRef(null);
    const handlePrintAllBarcode = useReactToPrint({
        contentRef: allBarcodePrintRef,
        documentTitle: 'All_Barcodes',
    });
    const [activeTab, setActiveTab] = useState('active');
    const [openMenuRowId, setOpenMenuRowId] = useState(null);
    const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
    const topMenuRef = useRef(null);
    const [editingSuggestWh, setEditingSuggestWh] = useState(null);

    // --- Custom History Dropdown States ---
    const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
    const historyDropdownRef = useRef(null);

    // --- Custom Fields Nested Modal States ---
    const [isNestedModalOpen, setIsNestedModalOpen] = useState(false);
    const [nestedFieldTarget, setNestedFieldTarget] = useState('add'); // 'add' or 'edit'
    const [nestedFieldIndex, setNestedFieldIndex] = useState(null);
    const [nestedFieldData, setNestedFieldData] = useState({ key: '', value: '' });

    // --- Bulk Selection & Action States ---
    const [selectedRows, setSelectedRows] = useState([]);

    const handleOpenNestedModal = (target, index = null, existingData = null) => {
        setNestedFieldTarget(target);
        setNestedFieldIndex(index);
        if (existingData) {
            setNestedFieldData(existingData);
        } else {
            setNestedFieldData({ key: '', value: '' });
        }
        setIsNestedModalOpen(true);
    };

    const handleSaveNestedField = async () => {
        if (!nestedFieldData.key || !nestedFieldData.value) {
            alert("Please enter both Key and Value.");
            return;
        }
        if (nestedFieldTarget === 'add') {
            setFormData(prev => {
                const arr = [...(prev.shipment_packaging || [])];
                if (nestedFieldIndex !== null) arr[nestedFieldIndex] = nestedFieldData;
                else arr.push(nestedFieldData);
                return { ...prev, shipment_packaging: arr };
            });
            setIsNestedModalOpen(false);
        } else {
            const arr = [...(editFormData.shipment_packaging || [])];
            if (nestedFieldIndex !== null) arr[nestedFieldIndex] = nestedFieldData;
            else arr.push(nestedFieldData);

            const newEditFormData = { ...editFormData, shipment_packaging: arr };
            setEditFormData(newEditFormData);

            try {
                await api.put("/edit-row", { itemId: newEditFormData.id, ...newEditFormData });
                setCalculationData(prev => prev.map(row => row.id === newEditFormData.id ? {
                    ...row,
                    shipment_packaging: JSON.stringify(newEditFormData.shipment_packaging)
                } : row));
            } catch (e) {
                alert("Failed to auto-save field to database.");
            }
            setIsNestedModalOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target)) {
                setIsHistoryDropdownOpen(false);
            }
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target)) {
                setIsDownloadDropdownOpen(false);
            }
            if (topMenuRef.current && !topMenuRef.current.contains(event.target)) {
                setIsTopMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- ROW DELETE HANDLER ---
    const handleDeleteRow = async (itemId) => {
        if (!window.confirm("Are you sure you want to delete this SKU?")) return false;
        try {
            await api.delete(`/delete-row/${itemId}`);
            setCalculationData(prev => prev.filter(row => row.id !== itemId));
            setSelectedRows(prev => prev.filter(id => id !== itemId));
            return true;
        } catch (error) {
            alert("Failed to delete row.");
            return false;
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRows.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} SKUs?`)) return;
        setIsLoading(true);
        try {
            await Promise.all(selectedRows.map(id => api.delete(`/delete-row/${id}`)));
            setCalculationData(prev => prev.filter(row => !selectedRows.includes(row.id)));
            setSelectedRows([]);
        } catch (error) {
            alert("Failed to delete some rows.");
        } finally {
            setIsLoading(false);
        }
    };
    // --- MODAL EDIT HANDLERS ---
    const startEditing = (row) => {
        let parsedCustomAttributes = [];
        try {
            if (row.shipment_packaging) {
                parsedCustomAttributes = typeof row.shipment_packaging === 'string'
                    ? JSON.parse(row.shipment_packaging)
                    : row.shipment_packaging;
            }
        } catch (e) { }

        setEditFormData({
            id: row.id,
            groupName: row.group_name, sku: row.sku, title: row.title,
            category: row.category, hsn: row.hsn, gst: row.gst, cost: row.cost,
            weight: row.weight, mrp: row.mrp, fnsku: row.fnsku,
            packing_dimension_length: row.packing_dimension_length,
            packing_dimension_width: row.packing_dimension_width,
            packing_dimension_height: row.packing_dimension_height,
            packing_dimension_unit: row.packing_dimension_unit || 'cm',
            isActive: row.is_active !== undefined ? row.is_active : 1,
            shipment_packaging: parsedCustomAttributes
        });
        setIsEditModalOpen(true);
        setOpenMenuRowId(null);
    };

    const openBarcodeModal = (row) => {
        setBarcodeData({ group_name: row.group_name, category: row.category, title: row.title, mrp: row.mrp || 0, fnsku: row.fnsku || '' });
        setIsBarcodeModalOpen(true);
        setOpenMenuRowId(null);
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
                weight: editFormData.weight, mrp: editFormData.mrp, fnsku: editFormData.fnsku,
                packing_dimension_length: editFormData.packing_dimension_length,
                packing_dimension_width: editFormData.packing_dimension_width,
                packing_dimension_height: editFormData.packing_dimension_height,
                packing_dimension_unit: editFormData.packing_dimension_unit || 'cm',
                is_active: editFormData.isActive,
                ref_sku: editFormData.sku, ref_title: editFormData.title,
                shipment_packaging: editFormData.shipment_packaging ? JSON.stringify(editFormData.shipment_packaging) : null
            } : row));
            setIsEditModalOpen(false);
        } catch (error) {
            alert("Failed to save edits.");
        }
    };

    const prevMarketplaceIdRef = useRef(filterMarketplaceId);

    useEffect(() => {
        const fetchHistory = async () => {
            if (prevMarketplaceIdRef.current !== filterMarketplaceId) {
                handlePlanChange(""); // Reset history selection ONLY on actual marketplace change
                prevMarketplaceIdRef.current = filterMarketplaceId;
            }
            if (!filterMarketplaceId) {
                setHistoryPlans([]);
                return;
            }
            try {
                const res = await api.get('/history', { params: { marketplace_id: filterMarketplaceId } });
                if (res.data?.success) {
                    setHistoryPlans(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch history");
            }
        };
        fetchHistory();
    }, [filterMarketplaceId]);

    const handleDeletePlan = async (planId, e) => {
        if (e) e.stopPropagation();
        if (!planId) {
            alert("Please select a plan to delete.");
            return;
        }
        if (window.confirm("Are you sure you want to delete this plan and its raw files?")) {
            try {
                const res = await api.delete(`/delete-plan/${planId}`);
                if (res.data?.success) {
                    if (Number(selectedHistoryPlanId) === Number(planId)) {
                        handlePlanChange("");
                        setCalculationData([]); // Clear table
                        setMasterData({});
                    }

                    // Re-fetch history
                    const historyRes = await api.get('/history', { params: { marketplace_id: filterMarketplaceId } });
                    if (historyRes.data?.success) {
                        setHistoryPlans(historyRes.data.data);
                    }

                    // Fetch current Calculation Data again
                    fetchCalculationData();
                }
            } catch (error) {
                alert("Failed to delete plan");
                console.error(error);
            }
        }
    };

    useEffect(() => {
        fetchCalculationData();
    }, [filterMarketplaceId, selectedHistoryPlanId, urlPlanId]);

    // --- API Handlers ---
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert("Pehle ek file select karein!");
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsLoading(true);

        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        uploadData.append("fileType", "Calculation"); // 🔥 NAYA ADD KIYA: Backend/Middleware ke liye
        uploadData.append("marketplace_id", selectedMarketplaceId);
        uploadData.append("shipment_mode", shipmentMode); // FC or IXD mode

        // Agar koi plan already open hai, toh uska planId bhejenge taaki usi me append ho
        const currentPlanId = selectedHistoryPlanId || (masterData && masterData.id);
        if (currentPlanId) {
            uploadData.append("planId", currentPlanId);
        }

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
            const errMsg = error.response?.data?.message || "Server error";
            alert(errMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        setIsLoading(true);
        try {
            let mpNames = ["amazone", "flipkart", "meesho"];
            try {
                const response = await api.get("/marketplaces");
                if (response.data && response.data.data) {
                    mpNames = response.data.data.map(mp => mp.name);
                }
            } catch (err) {
                console.error("Failed to fetch marketplaces for template", err);
            }

            const headers = ["Group Name", "SKU", "Title", "Category", "HSN", "GST", "Cost", "Weight", "MRP", "FNSKU", "shipment_packaging", "Length (L)", "Width (W)", "Height (H)", "Dimension Unit"];
            const wsTemplate = XLSX.utils.aoa_to_sheet([headers]);

            const extraSheetData = [mpNames]; // Horizontal array

            const wsIXD = XLSX.utils.aoa_to_sheet(extraSheetData);
            const wsWarehouse = XLSX.utils.aoa_to_sheet(extraSheetData);

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");
            XLSX.utils.book_append_sheet(wb, wsIXD, "IXD");
            XLSX.utils.book_append_sheet(wb, wsWarehouse, "Warehouse");

            XLSX.writeFile(wb, "Calculation_Template.xlsx");
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

    const handleCustomAttributeChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...(prev.shipment_packaging || [])];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, shipment_packaging: updated };
        });
    };
    const addCustomAttribute = () => setFormData(prev => ({ ...prev, shipment_packaging: [...(prev.shipment_packaging || []), { key: '', value: '' }] }));
    const removeCustomAttribute = (index) => {
        if (!window.confirm("Are you sure you want to delete this custom field?")) return;
        setFormData(prev => {
            const updated = [...(prev.shipment_packaging || [])];
            updated.splice(index, 1);
            return { ...prev, shipment_packaging: updated };
        });
    };

    const handleEditCustomAttributeChange = (index, field, value) => {
        setEditFormData(prev => {
            const updated = [...(prev.shipment_packaging || [])];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, shipment_packaging: updated };
        });
    };
    const addEditCustomAttribute = () => setEditFormData(prev => ({ ...prev, shipment_packaging: [...(prev.shipment_packaging || []), { key: '', value: '' }] }));
    const removeEditCustomAttribute = async (index) => {
        if (!window.confirm("Are you sure you want to delete this custom field?")) return;

        const updated = [...(editFormData.shipment_packaging || [])];
        updated.splice(index, 1);
        const newEditFormData = { ...editFormData, shipment_packaging: updated };
        setEditFormData(newEditFormData);

        try {
            await api.put("/edit-row", { itemId: newEditFormData.id, ...newEditFormData });
            setCalculationData(prev => prev.map(row => row.id === newEditFormData.id ? {
                ...row,
                shipment_packaging: JSON.stringify(newEditFormData.shipment_packaging)
            } : row));
        } catch (e) {
            alert("Failed to auto-delete field from database.");
        }
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

        // --- BYPASS DYNAMIC CALCULATION FOR COMPLETED PLANS ---
        if (masterData.status === 'Completed') {
            return calculationData.map((item) => ({
                ...item,
                total_weight: (item.final_wh && item.weight) ? Number(item.final_wh) * Number(item.weight) : ""
            }));
        }

        // Pass 1: Calculate basic dynamically changing fields (shipWh, finalWh, suggestFinalWh)
        const intermediateData = calculationData.map((item) => {
            const _multiplier = extractMultiplier(item.sku, item.title);
            const saleWh = Number(item.sale_wh) || 0;
            const availableQty = Number(item.available_qty) || 0;
            const saleWhAvg = Number(item.sale_wh_avg) || 0;

            let shipWh = 0;
            let suggestedShipWh = 0;
            
            if (item.fc_breakdown && typeof item.fc_breakdown === 'object' && Object.keys(item.fc_breakdown).length > 0) {
                let fcShipWhSum = 0;
                let fcSuggestedShipWhSum = 0;
                Object.values(item.fc_breakdown).forEach(fc => {
                    const fcSaleWh = Number(fc.sale_wh) || 0;
                    const fcSaleWhAvg = Number(fc.sale_wh_avg) || 0;
                    const fcAvail = Number(fc.available_qty) || 0;
                    if (afsDays > 0) {
                        const fcShip = Math.ceil(((fcSaleWh / afsDays) * shipmentPlanDays) - fcAvail);
                        if (fcShip > 0) fcShipWhSum += fcShip;
                        const fcSugShip = Math.ceil(((fcSaleWhAvg / afsDays) * shipmentPlanDays) - fcAvail);
                        if (fcSugShip > 0) fcSuggestedShipWhSum += fcSugShip;
                    }
                });
                shipWh = fcShipWhSum;
                suggestedShipWh = fcSuggestedShipWhSum;
            } else {
                if (afsDays > 0) {
                    shipWh = Math.ceil(((saleWh / afsDays) * shipmentPlanDays) - availableQty);
                    suggestedShipWh = Math.ceil(((saleWhAvg / afsDays) * shipmentPlanDays) - availableQty);
                }
            }

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

            let calculatedFinalWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh <= 0) calculatedFinalWh = "";
                else if (decWh === "") calculatedFinalWh = "";
                else calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
            }

            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            let totalWeight = "";
            if (displayFinalWh !== "" && displayFinalWh !== null && displayFinalWh !== undefined) {
                const weight = Number(item.weight) || 0;
                totalWeight = Number(displayFinalWh) * weight;
            }

            // suggestedShipWh already calculated above based on fc_breakdown logic

            let sugIntWh = "";
            if (!isNaN(suggestedShipWh)) {
                if (suggestedShipWh >= 0) {
                    if (suggestedShipWh === 0) sugIntWh = 1;
                    else if (bunchQty > 0) sugIntWh = Math.trunc(suggestedShipWh / bunchQty);
                }
            }

            let sugDecWh = "";
            if (sugIntWh !== "") {
                if (suggestedShipWh === 0) sugDecWh = 0;
                else if (bunchQty > 0) sugDecWh = (suggestedShipWh / bunchQty) - sugIntWh;
            }

            let suggestFinalWh = "";
            if (!isNaN(suggestedShipWh)) {
                if (suggestedShipWh <= 0) suggestFinalWh = "";
                else if (sugDecWh === "") suggestFinalWh = "";
                else suggestFinalWh = (sugIntWh * bunchQty) + (sugDecWh > 0 ? bunchQty : 0);
            }

            const displaySuggestFinalWh = item.is_manual_suggest_final_wh ? item.suggest_final_wh : suggestFinalWh;

            // Extract totalAvailable from DB string ("1563 / 0") if it exists
            let parsedTotalAvailable = null;
            if (item.stock_alloc && typeof item.stock_alloc === 'string' && item.stock_alloc.includes('/')) {
                const parts = item.stock_alloc.split('/');
                if (parts.length > 0) {
                    parsedTotalAvailable = Number(parts[0].trim());
                }
            } else if (item.group_available_qty !== undefined && item.group_available_qty !== null) {
                parsedTotalAvailable = Number(item.group_available_qty);
            }

            return {
                ...item,
                ship_wh: shipWh,
                int_wh: intWh,
                dec_wh: decWh,
                final_wh: displayFinalWh,
                suggest_final_wh: displaySuggestFinalWh,
                total_weight: totalWeight,
                _demand: Math.max(0, Number(displayFinalWh) || 0),
                _multiplier: _multiplier,
                _parsedTotalAvailable: parsedTotalAvailable
            };
        });

        // Pass 2: Calculate Group Demands and Extract Total Available per group
        const groupDemandMap = {};
        const groupTotalAvailableMap = {};
        const itemsByGroup = {};

        intermediateData.forEach(item => {
            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            if (!itemsByGroup[grp]) itemsByGroup[grp] = [];
            itemsByGroup[grp].push(item);

            if (!groupDemandMap[grp]) groupDemandMap[grp] = 0;
            groupDemandMap[grp] += (item._demand * item._multiplier);

            if (item._parsedTotalAvailable !== null && !isNaN(item._parsedTotalAvailable)) {
                groupTotalAvailableMap[grp] = item._parsedTotalAvailable;
            }
        });

        // Pass 2.5: Calculate exact allocations and distribute leftovers to maximize pack formation
        const groupAllocationMap = {}; // grp -> { [sku]: display_alloc_qty (packs) }

        Object.keys(itemsByGroup).forEach(grp => {
            const items = itemsByGroup[grp];
            const totalDemand = groupDemandMap[grp] || 0;
            const totalAvailable = groupTotalAvailableMap[grp];

            if (totalAvailable === undefined || totalAvailable === null) return;
            if (!groupAllocationMap[grp]) groupAllocationMap[grp] = {};

            if (totalDemand === 0) {
                items.forEach(item => { groupAllocationMap[grp][item.id] = 0; });
                return;
            }

            if (totalAvailable >= totalDemand) {
                items.forEach(item => { groupAllocationMap[grp][item.id] = item._demand; });
                return;
            }

            // Proportionate split and track initial packs
            let L = totalAvailable;
            const allocs = items.map(item => {
                const actualDemandItems = item._demand * item._multiplier;
                const exactAllocItems = (actualDemandItems / totalDemand) * totalAvailable;
                const initialPacks = Math.floor(exactAllocItems / item._multiplier);
                L -= (initialPacks * item._multiplier);
                return {
                    id: item.id,
                    demandPacks: item._demand,
                    mult: item._multiplier,
                    packs: initialPacks
                };
            });

            // Distribute L (Leftovers) greedy approach
            let changed = true;
            while (L > 0 && changed) {
                changed = false;
                let bestIdx = -1;
                let lowestRatio = Infinity;

                for (let i = 0; i < allocs.length; i++) {
                    const a = allocs[i];
                    if (a.mult <= L && a.demandPacks > 0 && a.packs < a.demandPacks) {
                        const ratio = a.packs / a.demandPacks;
                        if (ratio < lowestRatio) {
                            lowestRatio = ratio;
                            bestIdx = i;
                        }
                    }
                }

                // Fallback: If everyone reached demand but we still have L, just give it to anyone who can take it
                if (bestIdx === -1) {
                    for (let i = 0; i < allocs.length; i++) {
                        if (allocs[i].mult <= L) {
                            bestIdx = i;
                            break;
                        }
                    }
                }

                if (bestIdx !== -1) {
                    allocs[bestIdx].packs += 1;
                    L -= allocs[bestIdx].mult;
                    changed = true;
                }
            }

            items.forEach(item => {
                const a = allocs.find(al => al.id === item.id);
                groupAllocationMap[grp][item.id] = a ? a.packs : 0;
            });
        });

        // Pass 3: Map final display allocations back to items
        return intermediateData.map(item => {
            const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
            const totalAvailable = groupTotalAvailableMap[grp] !== undefined ? groupTotalAvailableMap[grp] : null;

            let display_alloc_qty = null;
            if (groupAllocationMap[grp] && groupAllocationMap[grp][item.id] !== undefined) {
                display_alloc_qty = groupAllocationMap[grp][item.id];
            }

            return {
                ...item,
                stock_alloc: totalAvailable !== null ? `${totalAvailable} / ${display_alloc_qty}` : '',
                stock_alloc_ratio: (totalAvailable !== null && item._demand > 0) ? (display_alloc_qty / item._demand) : null
            };
        });
    }, [calculationData, masterData.afs_days, masterData.shipment_plan_days, masterData.bunch_qty]);

    const displayDataRef = useRef([]);
    const warningTimeoutRef = useRef({});
    const warningHideTimeoutRef = useRef(null);

    useEffect(() => {
        displayDataRef.current = displayData;
    }, [displayData]);

    // FC Allocation state removed

    const [stockWarning, setStockWarning] = useState(null);

    const handleStockWarning = (rowId, val, colName, delay = 800, source = 'edit') => {
        if (warningTimeoutRef.current[rowId]) {
            clearTimeout(warningTimeoutRef.current[rowId]);
        }
        warningTimeoutRef.current[rowId] = setTimeout(() => {
            const currentData = displayDataRef.current;
            const latestRow = currentData.find(r => r.id === rowId);
            if (latestRow && latestRow.stock_alloc && latestRow.stock_alloc.includes(' / ')) {
                const alloc = Number(latestRow.stock_alloc.split(' / ')[1]);
                const requested = Number(val);
                if (requested > alloc && requested > 0) {
                    const diff = requested - alloc;
                    const multiplier = extractMultiplier(latestRow.sku, latestRow.title);

                    // Group Calculation
                    const groupName = latestRow.group_name ? latestRow.group_name.trim().toLowerCase() : 'unknown';
                    const totalGroupAvailablePieces = Number(latestRow.stock_alloc.split(' / ')[0]) || 0;

                    let totalGroupRequestedPieces = 0;
                    currentData.forEach(item => {
                        const grp = item.group_name ? item.group_name.trim().toLowerCase() : 'unknown';
                        if (grp === groupName) {
                            const itemMult = extractMultiplier(item.sku, item.title);
                            const itemVal = item.id === rowId ? requested : Number(colName === 'suggest_final_wh' ? item.suggest_final_wh : item.final_wh) || 0;
                            totalGroupRequestedPieces += (itemVal * itemMult);
                        }
                    });

                    const groupDiff = totalGroupRequestedPieces > totalGroupAvailablePieces
                        ? (totalGroupRequestedPieces - totalGroupAvailablePieces)
                        : 0;

                    setStockWarning({
                        rowId,
                        col: colName,
                        alloc: alloc * multiplier,
                        diff: diff * multiplier,
                        groupDiff: groupDiff,
                        groupName: latestRow.group_name || 'Unknown',
                        source
                    });

                    if (warningHideTimeoutRef.current) {
                        clearTimeout(warningHideTimeoutRef.current);
                    }
                    if (source === 'edit') {
                        warningHideTimeoutRef.current = setTimeout(() => {
                            setStockWarning(prev => (prev?.rowId === rowId && prev?.col === colName ? null : prev));
                        }, 5000);
                    }

                } else {
                    setStockWarning(prev => (prev?.rowId === rowId && prev?.col === colName ? null : prev));
                }
            }
        }, delay);
    };

    // Calculate which variant columns actually have data
    const activeVariantCols = useMemo(() => {
        const variantKeys = ['sky_blue', 'dark_blue', 'brown', 'green', 'tan', 'black', 'red', 'grey'];
        const active = {};
        variantKeys.forEach(k => active[k] = false);

        displayData.forEach(item => {
            variantKeys.forEach(k => {
                const val = item[`apr_${k}`];
                if (val !== undefined && val !== null && val !== 0 && val !== "0" && val !== "") {
                    active[k] = true;
                }
            });
        });
        return active;
    }, [displayData]);

    // Filter Logic for Search Bar
    const hasMissingData = (item) => {
        if (!item.weight || item.weight === '' || item.weight == 0) return true;
        if (!item.packing_dimension_length || item.packing_dimension_length === '' || item.packing_dimension_length == 0) return true;
        if (!item.packing_dimension_width || item.packing_dimension_width === '' || item.packing_dimension_width == 0) return true;
        if (!item.packing_dimension_height || item.packing_dimension_height === '' || item.packing_dimension_height == 0) return true;

        let missingPkg = false;
        try {
            const pkg = typeof item.shipment_packaging === 'string' ? JSON.parse(item.shipment_packaging) : item.shipment_packaging;
            if (!pkg || pkg.length === 0) missingPkg = true;
        } catch (e) {
            missingPkg = true;
        }
        if (missingPkg) return true;

        return false;
    };

    const missingRowsCount = displayData.filter(item => hasMissingData(item)).length;

    const filteredData = displayData.filter(item => {
        const isItemActive = item.is_active !== 0; // default 1 (active)
        const matchesTab = activeTab === 'active' ? isItemActive : !isItemActive;
        if (!matchesTab) return false;

        if (showMissingOnly && !hasMissingData(item)) return false;

        return (
            (item.group_name && item.group_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.hsn && item.hsn.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.gst && item.gst.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.cost && item.cost.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (item.weight && item.weight.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    });

    useEffect(() => {
        sessionStorage.setItem('boxes_calculation_data', JSON.stringify({
            items: filteredData,
            master: masterData
        }));
    }, [filteredData, masterData]);

    const totalToShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            let val = 0;
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const fcVal = Number(fcData.final_wh);
                    fcSum += isNaN(fcVal) ? 0 : fcVal;
                });
                val = fcSum;
            } else {
                val = Number(item.final_wh);
            }

            if (typeof item.stock_alloc === 'string') {
                if (item.stock_alloc.includes(' / ')) {
                    const alloc = Number(item.stock_alloc.split(' / ')[1]);
                    if (!isNaN(alloc)) val = alloc;
                } else {
                    val = 0; // Empty stock_alloc means 0 allocated
                }
            }

            return total + (isNaN(val) ? 0 : val);
        }, 0);
    }, [filteredData, shipmentMode]);

    const totalToSuggestShip = React.useMemo(() => {
        return filteredData.reduce((total, item) => {
            let val = 0;
            if (shipmentMode === 'FC' && item.fc_breakdown) {
                let fcSum = 0;
                Object.values(item.fc_breakdown).forEach(fcData => {
                    const fcVal = Number(fcData.suggest_final_wh);
                    fcSum += isNaN(fcVal) ? 0 : fcVal;
                });
                val = fcSum;
            } else {
                val = Number(item.suggest_final_wh);
            }

            if (typeof item.stock_alloc === 'string') {
                if (item.stock_alloc.includes(' / ')) {
                    const alloc = Number(item.stock_alloc.split(' / ')[1]);
                    if (!isNaN(alloc)) val = alloc;
                } else {
                    val = 0; // Empty stock_alloc means 0 allocated
                }
            }

            return total + (isNaN(val) ? 0 : val);
        }, 0);
    }, [filteredData, shipmentMode]);

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
        fc_id: 75, sale_total: 95, sale_wh: 95, sale_wh_avg: 130, ship_wh: 95, sum_val: 75, stock_alloc: 110, final_wh: 120, suggest_final_wh: 120
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
        ref_sku: true, ref_title: true, tra_qty: true, quantity: true, available_qty: true, sale_total: true, sale_wh: true, sale_wh_avg: true, ship_wh: true, sum_val: true, stock_alloc: true, final_wh: true, suggest_final_wh: true
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
    const variantsSpan = getColSpan(['sky_blue', 'dark_blue', 'brown', 'green', 'tan', 'black', 'red', 'grey'].filter(c => activeVariantCols[c]));
    const specsSpan = getColSpan(['weight', 'total_weight', 'hsn', 'gst', 'cost']);
    const logisticsSpan = getColSpan(['ref_sku', 'ref_title', 'tra_qty', 'quantity', 'available_qty', /*'sale_total',*/ 'sale_wh', 'sale_wh_avg', 'ship_wh', 'sum_val', 'final_wh', 'suggest_final_wh', 'stock_alloc']) + (shipmentMode === 'FC' ? 1 : 0);

    // 🔥 NAYA: Group Checkbox Toggle Logic
    const colGroupsConfig = {
        product: ['group_name', 'sku', 'title', 'category'],
        initialWH: ['int_wh', 'dec_wh', 'non_apron_qty'],
        variants: ['sky_blue', 'dark_blue', 'brown', 'green', 'tan', 'black', 'red', 'grey'],
        specs: ['weight', 'total_weight', 'hsn', 'gst', 'cost'],
        logistics: ['ref_sku', 'ref_title', 'tra_qty', 'quantity', 'available_qty', /*'sale_total',*/ 'sale_wh', 'sale_wh_avg', 'ship_wh', 'sum_val', 'final_wh', 'suggest_final_wh', 'stock_alloc']
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

            {/* ===== EVENT NOTIFICATION BANNERS ===== */}
            {activeEventNotifications.length > 0 && (
                <div className="flex flex-col gap-2">
                    {activeEventNotifications.map(event => (
                        <div
                            key={event.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 rounded-[8px] border border-[#5A5DF6]/30 bg-red-400"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <BellRing size={25} color='yellow' className="text-black shrink-0 animate-pulse font-20px" />
                                <span className="text-sm font-semibold text-black truncate">
                                    <span className="text-black text-[25px]">{event.event_name}</span>
                                    {event.daysLeft === 0
                                        ? ' starts today!'
                                        : event.daysLeft > 0
                                            ? ` starts in ${event.daysLeft} day${event.daysLeft > 1 ? 's' : ''}!`
                                            : ' has started!'
                                    }
                                    <span className="ml-2 text-[15px] font-normal text-black">(Multiplier: {event.multiplier}x)</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleEventAccept(event)}
                                    className="px-3 py-1 text-xs font-semibold rounded bg-white text-black "
                                >
                                    Accept
                                </button>
                                <button
                                    onClick={() => handleEventRemindLater(event.id)}
                                    className="px-3 py-1 text-xs font-semibold rounded bg-white text-black "
                                >
                                    Remind Me Later
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* COMPACT HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                    <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Shipment Calculation</h1>

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
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-48 mt-[2px]">
                        <MarketplaceDropdown
                            selectedId={filterMarketplaceId}
                            onChange={handleMarketplaceChange}
                            hideLabel={true}
                        />
                    </div>
                    <div className="relative flex items-center" ref={historyDropdownRef}>
                        <div
                            className="h-[34px] min-w-[200px] border border-[#D9DDE5] rounded-[4px] px-3 pr-8 text-xs text-[#1C2340] bg-white flex items-center cursor-pointer hover:border-[#5A5DF6] transition-colors relative"
                            onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
                        >
                            <span className="truncate w-full block">
                                {selectedHistoryPlanId
                                    ? (() => {
                                        const selectedPlan = historyPlans.find(p => p.id === Number(selectedHistoryPlanId));
                                        if (!selectedPlan) return "Select a Shipment...";
                                        const selectedIndex = historyPlans.indexOf(selectedPlan);
                                        const displayNum = historyPlans.length - selectedIndex;
                                        const dateStr = new Date(selectedPlan.created_at).toLocaleDateString();
                                        return `Shipment #${displayNum} - ${dateStr} ${selectedPlan.status === 'Completed' ? '(Manifested)' : ''}`;
                                    })()
                                    : "Select a Shipment..."}
                            </span>
                            <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 transition-transform ${isHistoryDropdownOpen ? 'rotate-180 text-[#5A5DF6]' : 'text-[#1C2340]/50'}`} />
                        </div>

                        {/* Custom Dropdown List */}
                        {isHistoryDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-[260px] max-h-[300px] overflow-y-auto bg-white border border-[#D9DDE5] rounded-[5px] shadow-lg z-50">
                                <div
                                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 transition-colors border-b border-[#D9DDE5]/30 ${!selectedHistoryPlanId ? 'bg-[#5A5DF6]/5' : ''}`}
                                    onClick={() => {
                                        handlePlanChange("");
                                        setIsHistoryDropdownOpen(false);
                                    }}
                                >
                                    <span className={`truncate ${!selectedHistoryPlanId ? 'text-[#5A5DF6] font-bold' : 'text-[#1C2340]'}`}>Select a Shipment...</span>
                                </div>
                                {historyPlans.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-gray-500 text-center">No plans found</div>
                                ) : (
                                    historyPlans.map((plan, index) => {
                                        const displayNum = historyPlans.length - index;
                                        return (
                                            <div
                                                key={plan.id}
                                                className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 transition-colors border-b border-[#D9DDE5]/30 last:border-0 ${Number(selectedHistoryPlanId) === plan.id ? 'bg-[#5A5DF6]/5' : ''}`}
                                                onClick={() => {
                                                    handlePlanChange(plan.id);
                                                    setIsHistoryDropdownOpen(false);
                                                }}
                                            >
                                                <span className={`truncate ${Number(selectedHistoryPlanId) === plan.id ? 'text-[#5A5DF6] font-bold' : 'text-[#1C2340]'}`}>
                                                    Shipment #{displayNum} - {new Date(plan.created_at).toLocaleDateString()} {plan.status === 'Completed' ? <span className="text-[10px] text-gray-500 ml-1">(Manifested)</span> : ''}
                                                </span>
                                                <button
                                                    onClick={(e) => handleDeletePlan(plan.id, e)}
                                                    className="p-1.5 rounded-[4px] text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-2 shrink-0"
                                                    title="Delete Shipment"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>
                    <div className="hidden md:block w-px h-4 bg-[#D9DDE5] mx-0.5"></div>
                    <button onClick={handleResetCalculations}
                        title="Manually edited Final-WH values ko formula se reset karega"
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-semibold text-[#E74C3C] hover:bg-red-50 shadow-sm"
                    >
                        <RefreshCcw size={12} />
                    </button>


                    <button onClick={() => setIsUploadModalOpen(true)} title="Upload File" className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D9DDE5] rounded-[4px] text-[11px] font-semibold text-[#1C2340] hover:bg-[#F4F5F7] shadow-sm transition-all">
                        <Upload size={12} className="text-[#5A5DF6]" /> Upload
                    </button>
                    <div className="hidden md:block w-px h-4 bg-[#D9DDE5] mx-0.5"></div>
                    <div className="relative" ref={downloadDropdownRef}>
                        <button
                            onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D9DDE5] rounded-[4px] text-[11px] font-semibold text-[#1C2340] hover:bg-[#F4F5F7] shadow-sm"
                        >
                            <Download size={12} className="text-[#5A5DF6]" /> Download <ChevronDown size={12} className="text-gray-400" />
                        </button>

                        {isDownloadDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#D9DDE5] rounded shadow-lg py-1 w-40">
                                <button
                                    onClick={() => {
                                        setIsDownloadDropdownOpen(false);
                                        // Sirf wo SKUs bhejo jinka Final-WH value 0 se zyada hai
                                        const manifestSkus = [];
                                        filteredData.forEach(item => {
                                            if (shipmentMode === 'FC' && item.fc_breakdown) {
                                                // Group by FC
                                                let parsedFcBreakdown = {};
                                                try {
                                                    parsedFcBreakdown = typeof item.fc_breakdown === 'string' ? JSON.parse(item.fc_breakdown) : item.fc_breakdown;
                                                    if (typeof parsedFcBreakdown === 'string') {
                                                        parsedFcBreakdown = JSON.parse(parsedFcBreakdown); // double parse in case of double stringified
                                                    }
                                                } catch(e) {
                                                    console.error("Parse error for sku:", item.sku, e);
                                                }
                                                console.log("manifest sku:", item.sku, "fc_breakdown orig:", item.fc_breakdown, "parsed:", parsedFcBreakdown);
                                                
                                                if (parsedFcBreakdown && typeof parsedFcBreakdown === 'object') {
                                                    Object.entries(parsedFcBreakdown).forEach(([fc, data]) => {
                                                        const finalWh = data.final_wh !== undefined && data.final_wh !== "" ? Number(data.final_wh) : Number(data.suggest_final_wh || 0);
                                                        if (finalWh > 0) {
                                                        manifestSkus.push({
                                                            sku: item.sku,
                                                            quantity: finalWh,
                                                            fc: fc,
                                                            hsn_sac_code: item.hsn,
                                                            gst_rate: item.gst,
                                                            declared_value_per_unit: item.cost,
                                                            weightPerPiece: item.weight,
                                                            group_name: item.group_name,
                                                            category: item.category,
                                                            fnsku: item.fnsku || '',
                                                            mrp: item.mrp || 0,
                                                            title: item.title || ''
                                                        });
                                                    }
                                                });
                                                }
                                            } else {
                                                let qty = 0;
                                                if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                                                    qty = Number(item.stock_alloc.split(' / ')[1]) || 0;
                                                }
                                                if (qty > 0) {
                                                    manifestSkus.push({
                                                        sku: item.sku,
                                                        quantity: qty,
                                                        fc: item.ixd_ixd_ixd_ixd_fulfilment_id,
                                                        hsn_sac_code: item.hsn,
                                                        gst_rate: item.gst,
                                                        declared_value_per_unit: item.cost,
                                                        weightPerPiece: item.weight,
                                                        group_name: item.group_name,
                                                        category: item.category,
                                                        fnsku: item.fnsku || '',
                                                        mrp: item.mrp || 0,
                                                        title: item.title || ''
                                                    });
                                                }
                                            }
                                        });
                                        navigate('/manifest', { state: { manifestSkus, marketplace_id: filterMarketplaceId } });
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1C2340] hover:bg-gray-50 flex items-center gap-2 font-semibold"
                                >
                                    <FileText size={12} className="text-[#5A5DF6]" /> Manifest
                                </button>
                                <button
                                    onClick={() => {
                                        setIsDownloadDropdownOpen(false);
                                        setIsAllBarcodeModalOpen(true);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[#1C2340] hover:bg-gray-50 flex items-center gap-2 font-semibold border-t border-gray-100"
                                >
                                    <Scan size={12} className="text-[#E74C3C]" /> All Barcodes
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="relative" ref={topMenuRef}>
                        <button
                            onClick={() => setIsTopMenuOpen(!isTopMenuOpen)}
                            className="p-1.5 text-[#1C2340]/60 hover:text-[#1C2340] hover:bg-gray-100 rounded border border-[#D9DDE5] transition-colors bg-white shadow-sm"
                        >
                            <MoreVertical size={16} />
                        </button>

                        {isTopMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#D9DDE5] rounded shadow-lg py-1 w-32">
                                <button
                                    onClick={() => { setActiveTab('active'); setIsTopMenuOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${activeTab === 'active' ? 'text-[#22B573] font-bold' : 'text-[#1C2340]'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'active' ? 'bg-[#22B573]' : 'bg-transparent'}`}></div> Active
                                </button>
                                <button
                                    onClick={() => { setActiveTab('inactive'); setIsTopMenuOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${activeTab === 'inactive' ? 'text-[#E74C3C] font-bold' : 'text-[#1C2340]'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full ${activeTab === 'inactive' ? 'bg-[#E74C3C]' : 'bg-transparent'}`}></div> Inactive
                                </button>
                                <div className="border-t border-[#D9DDE5] my-1"></div>
                                <button
                                    onClick={() => { setIsAddModalOpen(true); setIsTopMenuOpen(false); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-[#5A5DF6] hover:bg-gray-50 flex items-center gap-2 font-semibold"
                                >
                                    <Plus size={12} /> Add SKU
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table Card OR Empty State */}
            {(!masterData || !masterData.id) ? (
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm mt-3 p-12 flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-16 h-16 bg-[#5A5DF6]/10 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-[#5A5DF6]" />
                    </div>
                    <h2 className="text-[#1C2340] font-bold text-lg mb-2">No Calculation Data</h2>
                    <p className="text-[#1C2340]/60 text-sm max-w-md text-center">
                        Please select a Marketplace and Date from the top right to view historical calculations, or click below to create a new shipment plan.
                    </p>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="mt-6 flex items-center gap-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white px-5 py-2.5 rounded-[5px] text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Create New Shipment Plan
                    </button>
                </div>
            ) : (
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm flex flex-col min-w-0 overflow-hidden mt-3">

                    {/* COMPACT TABLE TOOLBAR (Updated with Filter Click Handler) */}
                    <div className="px-3 py-2 border-b border-[#D9DDE5] flex flex-wrap gap-2 items-center justify-between bg-[#F9FAFB] rounded-t-[5px]">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="flex items-center gap-2">
                                <div className="relative w-full max-w-xs">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1C2340]/40" size={14} />
                                    <input type="text" placeholder="Search by SKU or Title..." className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-[#D9DDE5] rounded-[4px] focus:outline-none focus:border-[#5A5DF6]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1C2340]/60 bg-[#D9DDE5]/30 px-2 py-1.5 rounded-[4px] whitespace-nowrap">
                                    <Layers size={12} /> <span>{filteredData.length} SKUs</span>
                                </div>
                                {selectedRows.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#E74C3C] hover:bg-[#c0392b] rounded-[4px] transition-colors whitespace-nowrap"
                                    >
                                        <Trash2 size={12} />
                                        Delete ({selectedRows.length})
                                    </button>
                                )}
                            </div>

                            <div className="w-px h-5 bg-[#D9DDE5] hidden md:block"></div>

                            <div
                                className={`flex items-center gap-1.5 whitespace-nowrap cursor-pointer px-2 py-1 rounded-[4px] border transition-colors ${showMissingOnly ? 'bg-red-50 border-red-200' : 'bg-transparent border-transparent hover:bg-gray-50'}`}
                                onClick={() => setShowMissingOnly(!showMissingOnly)}
                            >
                                <AlertCircle size={14} className={missingRowsCount > 0 ? "text-[#E74C3C]" : "text-[#1C2340]/40"} />
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${missingRowsCount > 0 ? "text-[#E74C3C]" : "text-[#1C2340]/40"}`}>Missing</span>
                                {missingRowsCount > 0 && <span className="text-sm font-bold text-[#E74C3C] px-0.5">{missingRowsCount}</span>}
                            </div>

                            <div className="w-px h-5 bg-[#D9DDE5] hidden md:block"></div>

                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <CalendarDays size={14} className="text-[#5A5DF6]" />
                                <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">AFS Days</span>
                                <span className="text-sm font-bold text-[#1C2340] px-0.5">{masterData.afs_days || 0}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-[4px] border border-orange-100">
                                <Package size={14} className="text-[#5A5DF6]" />
                                <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">To Suggest Ship</span>
                                <span className="text-sm font-bold text-[#1C2340]">{totalToSuggestShip.toLocaleString()}</span>
                            </div>

                            <div className="flex items-center gap-2 bg-[#5A5DF6]/10 px-3 py-1 rounded-[4px]">
                                <Package size={14} className="text-[#5A5DF6]" />
                                <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">To Ship</span>
                                <span className="text-sm font-bold text-[#1C2340]">{totalToShip.toLocaleString()}</span>
                            </div>

                            {/* 🔥 Filter Modal Trigger Button */}
                            <button onClick={() => setIsColumnFilterOpen(true)} className="p-1 text-[#1C2340]/60 hover:text-[#5A5DF6] hover:bg-[#5A5DF6]/10 rounded-[3px] transition-colors"><SlidersHorizontal size={14} /></button>
                        </div>
                    </div>

                    {/* 🔥 COMPLETE EXCEL-STYLE TABLE WITH FILTER & ACTIONS 🔥 */}
                    <div className="w-full overflow-x-auto overflow-y-auto custom-scrollbar bg-white" style={{ height: 'calc(100vh - 180px)' }}>
                        {filteredData.length === 0 ? (
                            <div className="flex justify-center items-center h-full min-h-[300px]">
                                <p className="text-sm text-[#1C2340]/50 font-medium py-10">No data found in database. Please upload a report.</p>
                            </div>
                        ) : (
                            <table ref={typeof tableRef !== 'undefined' ? tableRef : null} className="text-left whitespace-nowrap" style={typeof calculateTotalTableWidth === 'function' ? { width: calculateTotalTableWidth() } : { minWidth: "2500px" }}>

                                {/* 🔥 COLGROUP */}
                                <colgroup>
                                    <col style={{ width: 80, minWidth: 80, maxWidth: 80 }} />

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
                                        {visibleColumns.sky_blue && activeVariantCols.sky_blue && <col ref={el => colRefs.current.sky_blue = el} style={{ width: colWidthsRef.current.sky_blue }} />}
                                        {visibleColumns.dark_blue && activeVariantCols.dark_blue && <col ref={el => colRefs.current.dark_blue = el} style={{ width: colWidthsRef.current.dark_blue }} />}
                                        {visibleColumns.brown && activeVariantCols.brown && <col ref={el => colRefs.current.brown = el} style={{ width: colWidthsRef.current.brown }} />}
                                        {visibleColumns.green && activeVariantCols.green && <col ref={el => colRefs.current.green = el} style={{ width: colWidthsRef.current.green }} />}
                                        {visibleColumns.tan && activeVariantCols.tan && <col ref={el => colRefs.current.tan = el} style={{ width: colWidthsRef.current.tan }} />}
                                        {visibleColumns.black && activeVariantCols.black && <col ref={el => colRefs.current.black = el} style={{ width: colWidthsRef.current.black }} />}
                                        {visibleColumns.red && activeVariantCols.red && <col ref={el => colRefs.current.red = el} style={{ width: colWidthsRef.current.red }} />}
                                        {visibleColumns.grey && activeVariantCols.grey && <col ref={el => colRefs.current.grey = el} style={{ width: colWidthsRef.current.grey }} />}
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
                                        {shipmentMode === 'FC' && <col style={{ width: 100 }} />}
                                        {visibleColumns.sale_wh_avg && <col ref={el => colRefs.current.sale_wh_avg = el} style={{ width: colWidthsRef.current.sale_wh_avg }} />}
                                        {visibleColumns.sale_wh && <col ref={el => colRefs.current.sale_wh = el} style={{ width: colWidthsRef.current.sale_wh }} />}
                                        {visibleColumns.ship_wh && <col ref={el => colRefs.current.ship_wh = el} style={{ width: colWidthsRef.current.ship_wh }} />}
                                        {visibleColumns.sum_val && <col ref={el => colRefs.current.sum_val = el} style={{ width: colWidthsRef.current.sum_val }} />}
                                        {visibleColumns.stock_alloc && <col ref={el => colRefs.current.stock_alloc = el} style={{ width: colWidthsRef.current.stock_alloc }} />}
                                        {visibleColumns.final_wh && <col ref={el => colRefs.current.final_wh = el} style={{ width: colWidthsRef.current.final_wh }} />}
                                        {visibleColumns.suggest_final_wh && <col ref={el => colRefs.current.suggest_final_wh = el} style={{ width: colWidthsRef.current.suggest_final_wh }} />}
                                    </>)}
                                </colgroup>

                                {/* SMART THEAD */}
                                <thead className="sticky top-0 z-20 shadow-sm bg-white">
                                    {/* Top Row - Grouped Headers */}
                                    <tr className={`${typeof activeHead !== 'undefined' ? activeHead : 'text-[10px]'} font-bold text-[#1C2340]/60 uppercase tracking-wider border-b border-[#D9DDE5]`}>
                                        <th rowSpan={2} className="w-20 px-2 py-3 bg-[#1C2340]/5 border-r-2 border-[#D9DDE5] align-bottom text-center text-[#1C2340]/50 relative">
                                            <div className="flex items-end justify-between px-1 h-full pb-1">
                                                <input
                                                    type="checkbox"
                                                    className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer"
                                                    checked={filteredData.length > 0 && selectedRows.length === filteredData.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedRows(filteredData.map(row => row.id));
                                                        } else {
                                                            setSelectedRows([]);
                                                        }
                                                    }}
                                                    title="Select All"
                                                />
                                                {/* Placeholder to match row-level three dots and align checkbox left */}
                                                <div className="w-6 h-6"></div>
                                            </div>
                                        </th>

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
                                                {visibleColumns.sky_blue && activeVariantCols.sky_blue && <th style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/50 bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>Sky Blue</div><div onMouseDown={handleResizeMouseDown('sky_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.dark_blue && activeVariantCols.dark_blue && <th style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1E40AF]"></span>Dark Blue</div><div onMouseDown={handleResizeMouseDown('dark_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.brown && activeVariantCols.brown && <th style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#92400E]"></span>Brown</div><div onMouseDown={handleResizeMouseDown('brown')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.green && activeVariantCols.green && <th style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22B573]"></span>Green</div><div onMouseDown={handleResizeMouseDown('green')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.tan && activeVariantCols.tan && <th style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D2B48C]"></span>Tan</div><div onMouseDown={handleResizeMouseDown('tan')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.black && activeVariantCols.black && <th style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1C2340]"></span>Black</div><div onMouseDown={handleResizeMouseDown('black')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.red && activeVariantCols.red && <th style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>Red</div><div onMouseDown={handleResizeMouseDown('red')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.grey && activeVariantCols.grey && <th style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]"></span>Grey</div><div onMouseDown={handleResizeMouseDown('grey')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
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
                                                {visibleColumns.quantity && <th style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3 text-center bg-orange-50 relative group">DIH Quantity<div onMouseDown={handleResizeMouseDown('quantity')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.available_qty && <th style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3 text-center bg-orange-50 text-[#5A5DF6] font-bold relative group">Available Qty<div onMouseDown={handleResizeMouseDown('available_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {shipmentMode === 'FC' && <th style={{ width: 100, minWidth: 100 }} className="px-4 py-3 text-center bg-orange-50 text-[#1C2340] font-bold">FC</th>}
                                                {/* {visibleColumns.sale_total && <th style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-Total<div onMouseDown={handleResizeMouseDown('sale_total')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>} */}
                                                {visibleColumns.sale_wh_avg && <th style={{ width: colWidthsRef.current.sale_wh_avg, minWidth: colWidthsRef.current.sale_wh_avg }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-WH(4 MOS AVG)<div onMouseDown={handleResizeMouseDown('sale_wh_avg')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.sale_wh && <th style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-WH-CUR<div onMouseDown={handleResizeMouseDown('sale_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.ship_wh && <th style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Ship - WH<div onMouseDown={handleResizeMouseDown('ship_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.sum_val && <th style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center bg-orange-50 relative group">Sum<div onMouseDown={handleResizeMouseDown('sum_val')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.stock_alloc && <th style={{ width: colWidthsRef.current.stock_alloc, minWidth: colWidthsRef.current.stock_alloc }} className="px-4 py-3 text-center bg-orange-50 relative group">Stock Alloc<div onMouseDown={handleResizeMouseDown('stock_alloc')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.final_wh && <th style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className={`px-4 py-3 text-center font-bold relative group ${!useSuggestedWh ? 'bg-[#22B573]/20 text-[#1e9d64]' : 'bg-orange-50 text-[#E74C3C] opacity-60'}`}>Final-WH-CUR {!useSuggestedWh && <span className="text-[9px] bg-[#22B573] text-white px-1.5 py-0.5 rounded ml-1">ACTIVE</span>}<div onMouseDown={handleResizeMouseDown('final_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                                                {visibleColumns.suggest_final_wh && <th style={{ width: colWidthsRef.current.suggest_final_wh, minWidth: colWidthsRef.current.suggest_final_wh }} className={`px-4 py-3 text-center font-bold relative group ${useSuggestedWh ? 'bg-[#22B573]/20 text-[#1e9d64]' : 'bg-orange-50 text-[#5A5DF6] opacity-60'}`}>Sugg Final-WH {useSuggestedWh && <span className="text-[9px] bg-[#22B573] text-white px-1.5 py-0.5 rounded ml-1">ACTIVE</span>}<div onMouseDown={handleResizeMouseDown('suggest_final_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
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
                                            <React.Fragment key={row.id}>
                                                <tr className={`group hover:bg-[#F4F5F7]/80 hover:z-10 relative transition-colors text-[#1C2340]/80 ${typeof activeText !== 'undefined' ? activeText : 'text-xs'} ${expandedRows[row.id] ? 'bg-blue-50/20' : ''}`}>

                                                    {/* Action Column Cell */}
                                                    <td className="w-20 px-2 py-3 text-center bg-white border-r-2 border-[#D9DDE5] relative">
                                                        <div className="flex items-center justify-between px-1 h-full">
                                                            <div className="flex items-center gap-1.5">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer"
                                                                    checked={selectedRows.includes(row.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setSelectedRows(prev => [...prev, row.id]);
                                                                        } else {
                                                                            setSelectedRows(prev => prev.filter(id => id !== row.id));
                                                                        }
                                                                    }}
                                                                />
                                                                {hasMissingData(row) && (
                                                                    <AlertCircle size={14} className="text-[#E74C3C] animate-pulse" title="Missing required data (Weight, Dimensions, or Packaging)" />
                                                                )}
                                                                {shipmentMode === 'FC' && row.fc_breakdown && (
                                                                    <button
                                                                        onClick={() => toggleRowExpand(row.id)}
                                                                        className="p-0.5 ml-0.5 text-blue-600 hover:bg-blue-100 rounded"
                                                                        title="View FC Breakdown"
                                                                    >
                                                                        {expandedRows[row.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => setOpenMenuRowId(openMenuRowId === row.id ? null : row.id)}
                                                                className="p-1 text-[#1C2340]/60 hover:text-[#1C2340] hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>
                                                        </div>

                                                        {openMenuRowId === row.id && (
                                                            <div className="absolute left-10 top-2 z-50 bg-white border border-[#D9DDE5] rounded shadow-lg py-1 w-24 text-left">
                                                                <button
                                                                    onClick={() => { startEditing(row); setOpenMenuRowId(null); }}
                                                                    className="w-full text-left px-3 py-1.5 text-xs text-[#1C2340] hover:bg-gray-100 flex items-center gap-2"
                                                                >
                                                                    <Pencil size={12} className="text-[#5A5DF6]" /> Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => { openBarcodeModal(row); setOpenMenuRowId(null); }}
                                                                    className="w-full text-left px-3 py-1.5 text-xs text-[#1C2340] hover:bg-gray-100 flex items-center gap-2"
                                                                >
                                                                    <span className="text-[#5A5DF6] text-[10px] font-bold">|||</span> Barcode
                                                                </button>
                                                            </div>
                                                        )}
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
                                                            {visibleColumns.sky_blue && activeVariantCols.sky_blue && <td style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/30">{row.apr_sky_blue ? <span className="font-bold text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-[3px]">{row.apr_sky_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.dark_blue && activeVariantCols.dark_blue && <td style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center">{row.apr_dark_blue ? <span className="font-bold text-[#1E40AF] bg-[#1E40AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_dark_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.brown && activeVariantCols.brown && <td style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center">{row.apr_brown ? <span className="font-bold text-[#92400E] bg-[#92400E]/10 px-2 py-0.5 rounded-[3px]">{row.apr_brown}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.green && activeVariantCols.green && <td style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center">{row.apr_green ? <span className="font-bold text-[#22B573] bg-[#22B573]/10 px-2 py-0.5 rounded-[3px]">{row.apr_green}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.tan && activeVariantCols.tan && <td style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center">{row.apr_tan ? <span className="font-bold text-[#D2B48C] bg-[#D2B48C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_tan}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.black && activeVariantCols.black && <td style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center">{row.apr_black ? <span className="font-bold text-[#1C2340] bg-[#1C2340]/10 px-2 py-0.5 rounded-[3px]">{row.apr_black}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.red && activeVariantCols.red && <td style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center">{row.apr_red ? <span className="font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_red}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                                            {visibleColumns.grey && activeVariantCols.grey && <td style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center">{row.apr_grey ? <span className="font-bold text-[#9CA3AF] bg-[#9CA3AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_grey}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
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
                                                            {shipmentMode === 'FC' && <td style={{ width: 100, minWidth: 100 }} className="px-4 py-3 text-center font-bold text-gray-400 bg-[#F4F5F7]/20">-</td>}

                                                            {/* {visibleColumns.sale_total && <td style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center">{row.sale_total}</td>} */}
                                                            {visibleColumns.sale_wh_avg && <td style={{ width: colWidthsRef.current.sale_wh_avg, minWidth: colWidthsRef.current.sale_wh_avg }} className="px-4 py-3 text-center font-medium text-[#1C2340] bg-orange-50/20">{row.sale_wh_avg}</td>}
                                                            {visibleColumns.sale_wh && <td style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center">{row.sale_wh}</td>}
                                                            {visibleColumns.ship_wh && <td style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center">{liveShipWh}</td>}
                                                            {visibleColumns.sum_val && <td style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center">{row.sum_val}</td>}
                                                            {visibleColumns.stock_alloc && (
                                                                <td
                                                                    style={{ width: colWidthsRef.current.stock_alloc, minWidth: colWidthsRef.current.stock_alloc }}
                                                                    className="px-4 py-3 text-center font-bold"
                                                                    title={row.stock_alloc_ratio === null ? 'No Stock info' : `Fulfillment Ratio: ${Math.round(row.stock_alloc_ratio * 100)}%`}
                                                                >
                                                                    {row.stock_alloc ? (
                                                                        row.stock_alloc.includes(' / ') ? (
                                                                            <span>
                                                                                <span className="text-[#1C2340]">{row.stock_alloc.split(' / ')[0]}</span>
                                                                                <span className="text-[#1C2340]/60 mx-1">/</span>
                                                                                <span className={
                                                                                    row.stock_alloc_ratio === null ? 'text-[#1C2340]' :
                                                                                        row.stock_alloc_ratio >= 1 ? 'text-[#22B573]' :
                                                                                            'text-[#E74C3C]'
                                                                                }>{row.stock_alloc.split(' / ')[1]}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[#1C2340]">{row.stock_alloc}</span>
                                                                        )
                                                                    ) : <span className="text-[#1C2340]">-</span>}
                                                                </td>
                                                            )}
                                                            {visibleColumns.final_wh && <td style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className={`relative px-4 py-3 text-center ${!useSuggestedWh ? 'bg-[#22B573]/10' : 'bg-orange-50/30 opacity-60'}`} onMouseEnter={() => handleStockWarning(row.id, row.final_wh, 'final_wh', 0, 'hover')} onMouseLeave={() => setStockWarning(prev => prev?.source === 'hover' ? null : prev)}>
                                                                {stockWarning?.rowId === row.id && stockWarning?.col === 'final_wh' && (
                                                                    <div className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-[60] bg-[#1C2340] text-white text-[11px] p-3 rounded-[6px] shadow-xl w-[250px] whitespace-normal break-words animate-in fade-in zoom-in duration-200">
                                                                        <button onClick={() => setStockWarning(null)} className="absolute top-1.5 right-1.5 text-gray-400 hover:text-white cursor-pointer w-5 h-5 flex items-center justify-center font-bold text-sm">✕</button>
                                                                        <div className="flex items-center justify-center gap-1.5 text-orange-400 font-bold mb-1">
                                                                            <span className="text-sm">⚠️</span> Stock Exceeded
                                                                        </div>
                                                                        <div className="text-gray-200 leading-relaxed text-center mt-1">
                                                                            Sirf <b className="text-white">{stockWarning.alloc}</b> stock alloc hua hai. Aap <b className="text-red-400">{stockWarning.diff}</b> piece zyada bhej rahe ho.
                                                                        </div>
                                                                        {stockWarning.groupDiff > 0 && (
                                                                            <div className="text-gray-200 leading-relaxed text-center mt-1.5 pt-1.5 border-t border-gray-600">
                                                                                <b>Group "{stockWarning.groupName}"</b> ka total <b className="text-red-400">{stockWarning.groupDiff}</b> piece minus ja raha hai!
                                                                            </div>
                                                                        )}
                                                                        <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-[#1C2340] rotate-45"></div>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-center">
                                                                    <input type="number" value={row.final_wh === "" ? "" : row.final_wh} onChange={(e) => { const val = e.target.value; setCalculationData(prev => prev.map(p => p.id === row.id ? { ...p, final_wh: val, is_manual_final_wh: 1 } : p)); handleItemAutoSave(row.id, val); handleStockWarning(row.id, val, 'final_wh'); }} onWheel={handleWheelBlur} className="w-14 text-center font-bold bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none transition-colors" style={{ color: row.is_manual_final_wh ? '#5A5DF6' : '#1C2340' }} />
                                                                    {row.stock_alloc && row.stock_alloc.includes(' / ') && (
                                                                        <>
                                                                            <span className="text-[#1C2340]/60 mx-1">/</span>
                                                                            <span className={
                                                                                row.stock_alloc_ratio === null ? 'text-[#1C2340]' :
                                                                                    row.stock_alloc_ratio >= 1 ? 'text-[#22B573]' :
                                                                                        'text-[#E74C3C]'
                                                                            }>
                                                                                {row.stock_alloc.split(' / ')[1]}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>}
                                                            {visibleColumns.suggest_final_wh && (
                                                                <td
                                                                    style={{ width: colWidthsRef.current.suggest_final_wh, minWidth: colWidthsRef.current.suggest_final_wh }}
                                                                    className={`relative px-4 py-3 text-center font-bold ${useSuggestedWh ? 'bg-[#22B573]/10 text-[#1e9d64]' : 'bg-orange-50/30 text-[#5A5DF6] opacity-60'}`}
                                                                    onDoubleClick={() => setEditingSuggestWh(row.id)}
                                                                    onMouseEnter={() => handleStockWarning(row.id, row.suggest_final_wh, 'suggest_final_wh', 0, 'hover')}
                                                                    onMouseLeave={() => setStockWarning(prev => prev?.source === 'hover' ? null : prev)}
                                                                >
                                                                    {stockWarning?.rowId === row.id && stockWarning?.col === 'suggest_final_wh' && (
                                                                        <div className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 z-[60] bg-[#1C2340] text-white text-[11px] p-3 rounded-[6px] shadow-xl w-[250px] whitespace-normal break-words animate-in fade-in zoom-in duration-200">
                                                                            <button onClick={() => setStockWarning(null)} className="absolute top-1.5 right-1.5 text-gray-400 hover:text-white cursor-pointer w-5 h-5 flex items-center justify-center font-bold text-sm">✕</button>
                                                                            <div className="flex items-center justify-center gap-1.5 text-orange-400 font-bold mb-1">
                                                                                <span className="text-sm">⚠️</span> Stock Exceeded
                                                                            </div>
                                                                            <div className="text-gray-200 leading-relaxed text-center mt-1">
                                                                                Sirf <b className="text-white">{stockWarning.alloc}</b> stock alloc hua hai. Aap <b className="text-red-400">{stockWarning.diff}</b> piece zyada bhej rahe ho.
                                                                            </div>
                                                                            {stockWarning.groupDiff > 0 && (
                                                                                <div className="text-gray-200 leading-relaxed text-center mt-1.5 pt-1.5 border-t border-gray-600">
                                                                                    <b>Group "{stockWarning.groupName}"</b> ka total <b className="text-red-400">{stockWarning.groupDiff}</b> piece minus ja raha hai!
                                                                                </div>
                                                                            )}
                                                                            <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-[#1C2340] rotate-45"></div>
                                                                        </div>
                                                                    )}
                                                                    {editingSuggestWh === row.id ? (
                                                                        <input
                                                                            type="number"
                                                                            autoFocus
                                                                            value={row.suggest_final_wh === "" ? "" : row.suggest_final_wh}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                setCalculationData(prev => prev.map(p => p.id === row.id ? { ...p, suggest_final_wh: val, is_manual_suggest_final_wh: 1 } : p));
                                                                                handleStockWarning(row.id, val, 'suggest_final_wh');
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                handleSuggestAutoSave(row.id, e.target.value);
                                                                                setEditingSuggestWh(null);
                                                                            }}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    e.target.blur();
                                                                                }
                                                                            }}
                                                                            onWheel={handleWheelBlur}
                                                                            className="w-16 text-center font-bold bg-transparent border-b border-[#5A5DF6] outline-none text-[#5A5DF6]"
                                                                        />
                                                                    ) : (
                                                                        <span
                                                                            className="flex items-center justify-center"
                                                                            title={row.is_manual_suggest_final_wh ? "Manually edited. Double-click to edit again." : "Double-click to edit manually."}
                                                                        >
                                                                            <span className={`cursor-pointer text-[#1C2340] ${row.is_manual_suggest_final_wh ? 'underline decoration-dashed underline-offset-4' : ''}`}>
                                                                                {row.suggest_final_wh}
                                                                            </span>
                                                                            {row.stock_alloc && row.stock_alloc.includes(' / ') && (
                                                                                <>
                                                                                    <span className="text-[#1C2340]/60 mx-1">/</span>
                                                                                    <span className={
                                                                                        row.stock_alloc_ratio === null ? 'text-[#1C2340]' :
                                                                                            row.stock_alloc_ratio >= 1 ? 'text-[#22B573]' :
                                                                                                'text-[#E74C3C]'
                                                                                    }>
                                                                                        {row.stock_alloc.split(' / ')[1]}
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            )}

                                                        </>
                                                    ))}
                                                </tr>

                                                {/* Sub-rows for Multi-FC Mode */}
                                                {shipmentMode === 'FC' && expandedRows[row.id] && row.fc_breakdown && (
                                                    <tr className="bg-[#F8F9FA] border-b border-[#D9DDE5]">
                                                        <td colSpan={100} className="p-0">
                                                            <table className="w-full text-left text-xs text-[#1C2340]/80" style={{ tableLayout: 'fixed' }}>
                                                                <colgroup>
                                                                    {/* Duplicate the exact colgroup from parent to maintain perfect alignment */}
                                                                    <col style={{ width: 80, minWidth: 80, maxWidth: 80 }} />
                                                                    {collapsedGroups.product ? <col style={{ width: 40 }} /> : (
                                                                        <>
                                                                            {visibleColumns.group_name && <col style={{ width: colWidthsRef.current.group_name }} />}
                                                                            {visibleColumns.sku && <col style={{ width: colWidthsRef.current.sku }} />}
                                                                            {visibleColumns.title && <col style={{ width: colWidthsRef.current.title }} />}
                                                                            {visibleColumns.category && <col style={{ width: colWidthsRef.current.category }} />}
                                                                        </>
                                                                    )}
                                                                    {collapsedGroups.initialWH ? <col style={{ width: 40 }} /> : (
                                                                        <>
                                                                            {visibleColumns.int_wh && <col style={{ width: colWidthsRef.current.int_wh }} />}
                                                                            {visibleColumns.dec_wh && <col style={{ width: colWidthsRef.current.dec_wh }} />}
                                                                            {visibleColumns.non_apron_qty && <col style={{ width: colWidthsRef.current.non_apron_qty }} />}
                                                                        </>
                                                                    )}
                                                                    {collapsedGroups.variants ? <col style={{ width: 40 }} /> : (
                                                                        <>
                                                                            {visibleColumns.sky_blue && activeVariantCols.sky_blue && <col style={{ width: colWidthsRef.current.sky_blue }} />}
                                                                            {visibleColumns.dark_blue && activeVariantCols.dark_blue && <col style={{ width: colWidthsRef.current.dark_blue }} />}
                                                                            {visibleColumns.brown && activeVariantCols.brown && <col style={{ width: colWidthsRef.current.brown }} />}
                                                                            {visibleColumns.green && activeVariantCols.green && <col style={{ width: colWidthsRef.current.green }} />}
                                                                            {visibleColumns.tan && activeVariantCols.tan && <col style={{ width: colWidthsRef.current.tan }} />}
                                                                            {visibleColumns.black && activeVariantCols.black && <col style={{ width: colWidthsRef.current.black }} />}
                                                                            {visibleColumns.red && activeVariantCols.red && <col style={{ width: colWidthsRef.current.red }} />}
                                                                            {visibleColumns.grey && activeVariantCols.grey && <col style={{ width: colWidthsRef.current.grey }} />}
                                                                        </>
                                                                    )}
                                                                    {collapsedGroups.specs ? <col style={{ width: 40 }} /> : (
                                                                        <>
                                                                            {visibleColumns.weight && <col style={{ width: colWidthsRef.current.weight }} />}
                                                                            {visibleColumns.total_weight && <col style={{ width: colWidthsRef.current.total_weight }} />}
                                                                            {visibleColumns.hsn && <col style={{ width: colWidthsRef.current.hsn }} />}
                                                                            {visibleColumns.gst && <col style={{ width: colWidthsRef.current.gst }} />}
                                                                            {visibleColumns.cost && <col style={{ width: colWidthsRef.current.cost }} />}
                                                                        </>
                                                                    )}
                                                                    {collapsedGroups.logistics ? <col style={{ width: 40 }} /> : (
                                                                        <>
                                                                            {visibleColumns.ref_sku && <col style={{ width: colWidthsRef.current.ref_sku }} />}
                                                                            {visibleColumns.ref_title && <col style={{ width: colWidthsRef.current.ref_title }} />}
                                                                            {visibleColumns.tra_qty && <col style={{ width: colWidthsRef.current.tra_qty }} />}
                                                                            {visibleColumns.quantity && <col style={{ width: colWidthsRef.current.quantity }} />}
                                                                            {visibleColumns.available_qty && <col style={{ width: colWidthsRef.current.available_qty }} />}
                                                                            {shipmentMode === 'FC' && <col style={{ width: 100 }} />}
                                                                            {visibleColumns.sale_wh_avg && <col style={{ width: colWidthsRef.current.sale_wh_avg }} />}
                                                                            {visibleColumns.sale_wh && <col style={{ width: colWidthsRef.current.sale_wh }} />}
                                                                            {visibleColumns.ship_wh && <col style={{ width: colWidthsRef.current.ship_wh }} />}
                                                                            {visibleColumns.sum_val && <col style={{ width: colWidthsRef.current.sum_val }} />}
                                                                            {visibleColumns.stock_alloc && <col style={{ width: colWidthsRef.current.stock_alloc }} />}
                                                                            {visibleColumns.final_wh && <col style={{ width: colWidthsRef.current.final_wh }} />}
                                                                            {visibleColumns.suggest_final_wh && <col style={{ width: colWidthsRef.current.suggest_final_wh }} />}
                                                                        </>
                                                                    )}
                                                                </colgroup>
                                                                <tbody>
                                                                    {Object.entries(row.fc_breakdown).map(([fcName, data], fcIdx, fcArr) => (
                                                                        <tr key={fcName} className={`hover:bg-[#F0F2F5] transition-colors ${fcIdx !== fcArr.length - 1 ? 'border-b border-[#D9DDE5]/40' : ''}`}>
                                                                            <td className="px-4 py-2 border-r border-[#D9DDE5]/30"></td>
                                                                            {collapsedGroups.product ? <td className="px-4 py-2 border-r border-[#D9DDE5]/40"></td> : (
                                                                                <>
                                                                                    {visibleColumns.group_name && <td className="px-4 py-2 border-r border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.sku && <td className="px-4 py-2 border-r border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.title && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.category && <td className="px-4 py-2"></td>}
                                                                                </>
                                                                            )}

                                                                            {collapsedGroups.initialWH ? <td className="px-4 py-2 border-r border-[#D9DDE5]/40"></td> : (
                                                                                <>
                                                                                    {visibleColumns.int_wh && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.dec_wh && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.non_apron_qty && <td className="px-4 py-2"></td>}
                                                                                </>
                                                                            )}

                                                                            {collapsedGroups.variants ? <td className="px-4 py-2 border-r border-[#D9DDE5]/40"></td> : (
                                                                                <>
                                                                                    {visibleColumns.sky_blue && activeVariantCols.sky_blue && <td className="px-3 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.dark_blue && activeVariantCols.dark_blue && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.brown && activeVariantCols.brown && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.green && activeVariantCols.green && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.tan && activeVariantCols.tan && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.black && activeVariantCols.black && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.red && activeVariantCols.red && <td className="px-3 py-2"></td>}
                                                                                    {visibleColumns.grey && activeVariantCols.grey && <td className="px-3 py-2"></td>}
                                                                                </>
                                                                            )}

                                                                            {collapsedGroups.specs ? <td className="px-4 py-2 border-r border-[#D9DDE5]/40"></td> : (
                                                                                <>
                                                                                    {visibleColumns.weight && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.total_weight && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.hsn && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.gst && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.cost && <td className="px-4 py-2"></td>}
                                                                                </>
                                                                            )}

                                                                            {collapsedGroups.logistics ? <td className="px-4 py-2"></td> : (
                                                                                <>
                                                                                    {visibleColumns.ref_sku && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                    {visibleColumns.ref_title && <td className="px-4 py-2"></td>}
                                                                                    {visibleColumns.tra_qty && <td className="px-4 py-2 text-center font-semibold text-[#5A5DF6]">{data.tra_qty}</td>}
                                                                                    {visibleColumns.quantity && <td className="px-4 py-2 text-center font-medium">{data.quantity}</td>}
                                                                                    {visibleColumns.available_qty && <td className="px-4 py-2 text-center font-bold text-[#1C2340] bg-[#F4F5F7]/50">{data.available_qty}</td>}
                                                                                    {shipmentMode === 'FC' && <td className="px-4 py-2 text-center font-bold text-[#5A5DF6] bg-blue-50/20">{fcName}</td>}
                                                                                    {visibleColumns.sale_wh_avg && <td className="px-4 py-2 text-center font-medium text-[#1C2340] bg-orange-50/20">{data.sale_wh_avg}</td>}
                                                                                    {visibleColumns.sale_wh && <td className="px-4 py-2 text-center">{data.sale_wh}</td>}
                                                                                    {visibleColumns.ship_wh && <td className="px-4 py-2 text-center">{liveAfsDays > 0 ? Math.ceil(((data.sale_wh / liveAfsDays) * livePlanDays) - data.available_qty) : 0}</td>}
                                                                                    {visibleColumns.sum_val && <td className="px-4 py-2 text-center font-bold bg-[#F4F5F7]"></td>}
                                                                                    {visibleColumns.stock_alloc && <td className="px-4 py-2 text-center font-bold text-[#E74C3C] bg-red-50/30">{data.stock_alloc !== null && data.stock_alloc !== undefined ? data.stock_alloc : ''}</td>}
                                                                                    {visibleColumns.final_wh && (
                                                                                        <td className={`px-4 py-2 text-center ${!useSuggestedWh ? 'bg-[#22B573]/10' : 'bg-orange-50/30 opacity-60'}`}>
                                                                                            <div className="flex items-center justify-center gap-1">
                                                                                                <input
                                                                                                    type="number"
                                                                                                    value={data.final_wh === "" ? data.suggest_final_wh : data.final_wh}
                                                                                                    onChange={(e) => handleFcFinalWhSubmit(row.id, fcName, e.target.value)}
                                                                                                    className="w-14 text-center font-bold bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none transition-colors"
                                                                                                    style={{ color: data.final_wh !== "" ? '#5A5DF6' : '#1C2340' }}
                                                                                                />
                                                                                                {data.stock_alloc && typeof data.stock_alloc === 'string' && data.stock_alloc.includes(' / ') && (
                                                                                                    <>
                                                                                                        <span className="text-[#1C2340]/60 mx-1">/</span>
                                                                                                        <span className={
                                                                                                            data.fc_demand > 0 && (Number(data.stock_alloc.split(' / ')[1]) / data.fc_demand) >= 1 ? 'text-[#22B573] text-xs font-bold' :
                                                                                                                data.fc_demand > 0 ? 'text-[#E74C3C] text-xs font-bold' : 'text-[#1C2340] text-xs font-bold'
                                                                                                        }>
                                                                                                            {data.stock_alloc.split(' / ')[1]}
                                                                                                        </span>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                        </td>
                                                                                    )}
                                                                                    {visibleColumns.suggest_final_wh && (
                                                                                        <td className={`px-4 py-2 text-center font-bold ${useSuggestedWh ? 'bg-[#22B573]/10 text-[#1e9d64]' : 'bg-orange-50/30 text-[#5A5DF6] opacity-60'}`}>
                                                                                            <span className="flex items-center justify-center">
                                                                                                <span className="text-[#1C2340]">{data.suggest_final_wh}</span>
                                                                                                {data.stock_alloc && typeof data.stock_alloc === 'string' && data.stock_alloc.includes(' / ') && (
                                                                                                    <>
                                                                                                        <span className="text-[#1C2340]/60 mx-1">/</span>
                                                                                                        <span className={
                                                                                                            data.fc_demand > 0 && (Number(data.stock_alloc.split(' / ')[1]) / data.fc_demand) >= 1 ? 'text-[#22B573]' :
                                                                                                                data.fc_demand > 0 ? 'text-[#E74C3C]' : 'text-[#1C2340]'
                                                                                                        }>
                                                                                                            {data.stock_alloc.split(' / ')[1]}
                                                                                                        </span>
                                                                                                    </>
                                                                                                )}
                                                                                            </span>
                                                                                        </td>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>)}
                    </div>
                </div>
            )}

            {/* Modals Code from previous version remains exactly the same below... */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1C2340]/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[8px] shadow-xl w-full max-w-md overflow-visible">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between rounded-t-[8px]">
                            <h3 className="font-bold text-[#1C2340]">Upload Calculation Report</h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleFileUpload} className="p-6 space-y-5">
                            {/* Marketplace Dropdown */}
                            <div className="z-50 relative">
                                <MarketplaceDropdown
                                    selectedId={selectedMarketplaceId}
                                    onChange={setSelectedMarketplaceId}
                                />
                            </div>

                            <div
                                className={`border-2 border-dashed border-[#D9DDE5] rounded-[5px] bg-[#F4F5F7]/30 p-8 flex flex-col items-center justify-center transition-colors ${!selectedMarketplaceId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F4F5F7]/80 cursor-pointer'}`}
                                onClick={() => {
                                    if (!selectedMarketplaceId) {
                                        alert("Please select a marketplace first!");
                                        return;
                                    }
                                    fileInputRef.current.click();
                                }}
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
                            <button type="submit" disabled={isLoading || !selectedFile || !selectedMarketplaceId} className="w-full bg-[#5A5DF6] text-white py-2.5 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#494ce0] disabled:opacity-70">
                                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : "Upload & Process"}
                            </button>
                            <button type="button" onClick={handleDownloadTemplate} className="w-full bg-white text-[#5A5DF6] border border-[#5A5DF6] py-2 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#5A5DF6]/5 transition-colors mt-2">
                                <Download size={16} /> Download Template
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. MANUAL ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-[#F4F5F7]">
                            <h3 className="font-bold text-[#1C2340] text-lg">Add New SKU Details</h3>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => handleOpenNestedModal('add')} className="text-xs font-bold text-[#5A5DF6] hover:text-[#494ce0] flex items-center gap-1 border border-[#5A5DF6] px-2 py-1 rounded bg-white">+ Add Field</button>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                                    <CloseIcon size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {/* 🔥 UPDATED ADD SKU FORM 🔥 */}
                            <form id="add-sku-form" onSubmit={handleManualSubmit} className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product & Financial Info</h4>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs text-gray-600">Group Name *</label>
                                                <input type="text" name="groupName" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. APR- Black" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">SKU *</label>
                                                <input type="text" name="sku" required onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. Apron_Black" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-600">Title</label>
                                            <textarea name="title" rows="2" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Full Product Title..." />
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
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
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <label className="text-xs text-gray-600">Cost (₹)</label>
                                                <input type="number" step="0.01" name="cost" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Weight (kg/g)</label>
                                                <input type="number" step="0.01" name="weight" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. 0.5" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">MRP (₹)</label>
                                                <input type="number" step="0.01" name="mrp" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="0.00" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-5 gap-6 mt-6">
                                            <div>
                                                <label className="text-xs text-gray-600">FNSKU</label>
                                                <input type="text" name="fnsku" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. X00..." />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Length (L)</label>
                                                <input type="number" step="0.01" name="packing_dimension_length" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Length" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Width (W)</label>
                                                <input type="number" step="0.01" name="packing_dimension_width" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Width" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Height (H)</label>
                                                <input type="number" step="0.01" name="packing_dimension_height" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="Height" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Unit</label>
                                                <select name="packing_dimension_unit" onChange={handleInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" defaultValue="cm">
                                                    <option value="mm">mm</option>
                                                    <option value="cm">cm</option>
                                                    <option value="inch">inch</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {formData.shipment_packaging && formData.shipment_packaging.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Additional Information</h4>
                                            <div className="overflow-hidden border rounded-lg">
                                                <table className="w-full text-left text-sm text-gray-600">
                                                    <thead className="bg-gray-50 border-b">
                                                        <tr>
                                                            <th className="py-2 px-4 font-semibold">Shipment Packaging</th>
                                                            <th className="py-2 px-4 font-semibold text-center">Unit / Box</th>
                                                            <th className="py-2 px-4 font-semibold text-center whitespace-nowrap">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {formData.shipment_packaging.map((attr, index) => (
                                                            <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                                                                <td className="py-2 px-4">{attr.key}</td>
                                                                <td className="py-2 px-4 text-center">{attr.value}</td>
                                                                <td className="py-2 px-4 text-center">
                                                                    <button type="button" onClick={() => handleOpenNestedModal('add', index, attr)} className="text-[#5A5DF6] hover:text-[#494ce0] mr-3" title="Edit Field">
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button type="button" onClick={() => removeCustomAttribute(index)} className="text-red-400 hover:text-red-600" title="Delete Field">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-gray-400 mt-4 italic">* FC ID will automatically be set to 'BLR4'. Other quantities will be initialized to 0.</p>
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border rounded text-sm font-medium hover:bg-gray-100 transition-colors">Cancel</button>
                            <button type="submit" form="add-sku-form" disabled={isLoading} className="px-4 py-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded text-sm font-medium transition-colors flex items-center gap-2">
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
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => handleOpenNestedModal('edit')} className="text-xs font-bold text-[#5A5DF6] hover:text-[#494ce0] flex items-center gap-1 border border-[#5A5DF6] px-2 py-1 rounded bg-white">+ Add Field</button>
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                                    <CloseIcon size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="edit-sku-form" onSubmit={handleEditSubmit} className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Product & Financial Info</h4>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs text-gray-600">Group Name *</label>
                                                <input type="text" name="groupName" value={editFormData.groupName || ''} required onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">SKU *</label>
                                                <input type="text" name="sku" value={editFormData.sku || ''} required onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-600">Title</label>
                                            <textarea name="title" rows="2" value={editFormData.title || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
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
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <label className="text-xs text-gray-600">Cost (₹)</label>
                                                <input type="number" step="0.01" name="cost" value={editFormData.cost ?? ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Weight (kg/g)</label>
                                                <input type="number" step="0.01" name="weight" value={editFormData.weight ?? ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">MRP (₹)</label>
                                                <input type="number" step="0.01" name="mrp" value={editFormData.mrp ?? ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-5 gap-6 mt-6">
                                            <div>
                                                <label className="text-xs text-gray-600">FNSKU</label>
                                                <input type="text" name="fnsku" value={editFormData.fnsku || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Length (L)</label>
                                                <input type="number" step="0.01" name="packing_dimension_length" value={editFormData.packing_dimension_length || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Width (W)</label>
                                                <input type="number" step="0.01" name="packing_dimension_width" value={editFormData.packing_dimension_width || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Height (H)</label>
                                                <input type="number" step="0.01" name="packing_dimension_height" value={editFormData.packing_dimension_height || ''} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-600">Unit</label>
                                                <select name="packing_dimension_unit" value={editFormData.packing_dimension_unit || 'cm'} onChange={handleEditInputChange} className="w-full border rounded px-3 py-1.5 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]">
                                                    <option value="mm">mm</option>
                                                    <option value="cm">cm</option>
                                                    <option value="inch">inch</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {editFormData.shipment_packaging && editFormData.shipment_packaging.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-gray-100">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Additional Information</h4>
                                            <div className="overflow-hidden border rounded-lg">
                                                <table className="w-full text-left text-sm text-gray-600">
                                                    <thead className="bg-gray-50 border-b">
                                                        <tr>
                                                            <th className="py-2 px-4 font-semibold">Shipment Packaging</th>
                                                            <th className="py-2 px-4 font-semibold text-center">Unit / Box</th>
                                                            <th className="py-2 px-4 font-semibold text-center whitespace-nowrap">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {editFormData.shipment_packaging.map((attr, index) => (
                                                            <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                                                                <td className="py-2 px-4">{attr.key}</td>
                                                                <td className="py-2 px-4 text-center">{attr.value}</td>
                                                                <td className="py-2 px-4 text-center">
                                                                    <button type="button" onClick={() => handleOpenNestedModal('edit', index, attr)} className="text-[#5A5DF6] hover:text-[#494ce0] mr-3" title="Edit Field">
                                                                        <Pencil size={14} />
                                                                    </button>
                                                                    <button type="button" onClick={() => removeEditCustomAttribute(index)} className="text-red-400 hover:text-red-600" title="Delete Field">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action row: Toggle & Delete */}
                                    <div className="flex items-center gap-8 mt-6 pt-5 border-t border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setEditFormData({ ...editFormData, isActive: editFormData.isActive ? 0 : 1 })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editFormData.isActive ? 'bg-[#22B573]' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editFormData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                            <span className={`text-sm font-bold ${editFormData.isActive ? 'text-[#22B573]' : 'text-gray-500'}`}>
                                                {editFormData.isActive ? 'Active' : 'Inactive'}
                                            </span>
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
                                    <input type="checkbox" checked={colGroupsConfig.product.every(k => visibleColumns[k])} onChange={(e) => handleGroupToggle('product', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
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
                                    <input type="checkbox" checked={colGroupsConfig.initialWH.every(k => visibleColumns[k])} onChange={(e) => handleGroupToggle('initialWH', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
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
                                    <input type="checkbox" checked={colGroupsConfig.variants.every(k => visibleColumns[k])} onChange={(e) => handleGroupToggle('variants', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
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
                                    <input type="checkbox" checked={colGroupsConfig.specs.every(k => visibleColumns[k])} onChange={(e) => handleGroupToggle('specs', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
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
                                    <input type="checkbox" checked={colGroupsConfig.logistics.every(k => visibleColumns[k])} onChange={(e) => handleGroupToggle('logistics', e.target.checked)} className="w-3.5 h-3.5 accent-[#5A5DF6] cursor-pointer" />
                                    <span className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider group-hover:text-[#5A5DF6] transition-colors">Logistics</span>
                                </label>
                                <div className="space-y-2.5">
                                    {[['ref_sku', 'SKU (Ref)'], ['ref_title', 'Title (Ref)'], ['tra_qty', 'Tra. Qty'], ['quantity', 'Quantity'], ['available_qty', 'Available Qty'], ['FC ID'], /*['sale_total', 'Sale-Total'],*/['sale_wh', 'Sale-WH'], ['ship_wh', 'Ship-WH'], ['sum_val', 'Sum'], ['stock_alloc', 'Allocated Stock'], ['final_wh', 'Final-WH']].map(([k, l]) => (
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
            {/* 🔥 NESTED MODAL FOR CUSTOM FIELDS 🔥 */}
            {isNestedModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-[#1C2340] text-sm">{nestedFieldIndex !== null ? "Edit Custom Field" : "Add Custom Field"}</h3>
                            <button onClick={() => setIsNestedModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs text-gray-600">Shipment Packaging *</label>
                                <input type="text" value={nestedFieldData.key} onChange={(e) => setNestedFieldData({ ...nestedFieldData, key: e.target.value })} className="w-full border rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. Outer Box" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600">Unit / Box *</label>
                                <input type="text" value={nestedFieldData.value} onChange={(e) => setNestedFieldData({ ...nestedFieldData, value: e.target.value })} className="w-full border rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:border-[#5A5DF6]" placeholder="e.g. 50" />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsNestedModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors">Cancel</button>
                            <button type="button" onClick={handleSaveNestedField} className="px-4 py-2 bg-[#5A5DF6] text-white text-sm font-bold rounded hover:bg-[#494ce0] transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 BARCODE MODAL 🔥 */}
            {isBarcodeModalOpen && barcodeData && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-5 py-4 border-b bg-gray-50 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-[#1C2340] text-sm">Print Barcode</h3>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowBarcodePreview(!showBarcodePreview)} className="text-gray-400 hover:text-[#5A5DF6]" title="Toggle Preview">
                                        {showBarcodePreview ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button onClick={() => setIsBarcodeModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={barcodeType}
                                        onChange={(e) => setBarcodeType(e.target.value)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#5A5DF6] cursor-pointer"
                                    >
                                        <option value="product">Product Barcode</option>
                                        <option value="fnsku">FNSKU Barcode</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                    <input
                                        type="number"
                                        value={activeBarcodeSize.width}
                                        onChange={(e) => handleBarcodeSizeChange(e, 'width')}
                                        className="w-12 border border-gray-300 rounded px-1 text-center outline-none focus:border-[#5A5DF6]"
                                    />
                                    <span className="text-gray-500">x</span>
                                    <input
                                        type="number"
                                        value={activeBarcodeSize.height}
                                        onChange={(e) => handleBarcodeSizeChange(e, 'height')}
                                        className="w-12 border border-gray-300 rounded px-1 text-center outline-none focus:border-[#5A5DF6]"
                                    />
                                    <span className="text-gray-500 text-[10px]">mm</span>
                                </div>
                            </div>
                        </div>

                        {showBarcodePreview && (
                            <div className="p-5 flex justify-center bg-gray-100 overflow-auto">
                                {/* Printable Area */}
                                <div
                                    ref={barcodePrintRef}
                                    className="bg-white"
                                    style={{
                                        width: `${activeBarcodeSize.width || 50}mm`,
                                        height: `${activeBarcodeSize.height || 25}mm`,
                                        padding: barcodeType === 'product' ? '2mm 3mm' : '1.5mm 2mm',
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: barcodeType === 'product' ? 'space-between' : 'flex-start',
                                        overflow: 'hidden',
                                        fontFamily: 'Arial, Helvetica, sans-serif'
                                    }}
                                >
                                    <style type="text/css" media="print">
                                        {`
                                            @page { size: ${activeBarcodeSize.width || 50}mm ${activeBarcodeSize.height || 25}mm !important; margin: 0 !important; }
                                            body { margin: 0 !important; padding: 0 !important; width: ${activeBarcodeSize.width || 50}mm !important; height: ${activeBarcodeSize.height || 25}mm !important; }
                                            svg, canvas, img { shape-rendering: crispEdges; image-rendering: pixelated; }
                                        `}
                                    </style>
                                    <style type="text/css">
                                        {`
                                            svg, canvas, img { shape-rendering: crispEdges; image-rendering: pixelated; }
                                        `}
                                    </style>

                                    {barcodeType === 'product' ? (
                                        <>
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1' }}>
                                                CRASOME
                                            </div>
                                            <table style={{ width: '100%', fontSize: '7px', lineHeight: '1.2', marginTop: '1px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', width: '32%', verticalAlign: 'top', padding: 0, fontSize: "9px" }}>PRODUCT</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: "9px" }}>: {barcodeData.category || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0, fontSize: "9px" }}>MODEL</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: "9px" }}>: {barcodeData.group_name || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0, fontSize: "9px" }}>MRP</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', fontSize: "9px" }}>: ₹{barcodeData.mrp || 0}.00 <span style={{ fontSize: '7px' }}>(Incl. of all taxes)</span></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div style={{ borderTop: '1px solid #000', margin: '1px 0' }}></div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                                <Barcode
                                                    value={barcodeData.group_name || 'UNKNOWN'}
                                                    width={1.3}
                                                    height={20}
                                                    displayValue={false}
                                                    margin={0}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', height: '100%', gap: '0px' }}>
                                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                                <Barcode
                                                    value={barcodeData.fnsku || 'UNKNOWN'}
                                                    width={((parseFloat(activeBarcodeSize.width) || 50) / 50) * 1.2}
                                                    height={((parseFloat(activeBarcodeSize.height) || 25) / 25) * 40}
                                                    displayValue={false}
                                                    margin={0}
                                                />
                                            </div>
                                            <div style={{ fontSize: `${((parseFloat(activeBarcodeSize.width) || 50) / 50) * 11}px`, fontWeight: 'normal', marginTop: '1mm', fontFamily: 'Arial, Helvetica, sans-serif', letterSpacing: '0.2px', color: '#000', lineHeight: '1.2' }}>
                                                {barcodeData.fnsku || 'UNKNOWN'}
                                            </div>
                                            <div style={{ fontSize: `${((parseFloat(activeBarcodeSize.width) || 50) / 50) * 8}px`, fontWeight: 'normal', textAlign: 'center', wordBreak: 'break-word', lineHeight: '1.2', maxWidth: '95%', fontFamily: 'Arial, Helvetica, sans-serif', marginTop: '0px', color: '#000' }}>
                                                New - {formatFnskuTitle(barcodeData.title)}
                                            </div>
                                            <div style={{ fontSize: `${((parseFloat(activeBarcodeSize.width) || 50) / 50) * 9.5}px`, fontWeight: 'normal', marginTop: '0px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', lineHeight: '1.2' }}>
                                                MRP : ₹ {barcodeData.mrp || 0}/-
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button type="button" onClick={() => setIsBarcodeModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors">Cancel</button>
                            <button type="button" onClick={handlePrintBarcode} className="px-4 py-2 bg-[#5A5DF6] text-white text-sm font-bold rounded hover:bg-[#494ce0] transition-colors flex items-center gap-2">
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔥 ALL BARCODES MODAL 🔥 */}
            {isAllBarcodeModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="font-bold text-[#1C2340] text-sm">Print All Barcodes</h3>
                                <p className="text-xs text-gray-500 mt-1">Total {filteredData.length} SKUs will be printed as individual 50x25mm labels.</p>
                            </div>
                            <button onClick={() => setIsAllBarcodeModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <div className="p-5 flex-1 overflow-y-auto bg-gray-100 flex flex-wrap gap-6 justify-center content-start">
                            {/* Hidden Printable Area for All Barcodes */}
                            <div style={{ overflow: 'hidden', height: 0, width: 0, position: 'absolute' }}>
                                <div ref={allBarcodePrintRef} className="bg-white">
                                    <style type="text/css" media="print">
                                        {`
                                            @page { size: 50mm 25mm !important; margin: 0 !important; }
                                            body { margin: 0 !important; padding: 0 !important; width: 50mm !important; height: 25mm !important; background: white; }
                                            .page-break { page-break-after: always; page-break-inside: avoid; }
                                            .page-break:last-child { page-break-after: auto; }
                                        `}
                                    </style>
                                    {filteredData.map((item, idx) => (
                                        <div
                                            key={idx}
                                            className="page-break bg-white flex flex-col"
                                            style={{
                                                width: '50mm',
                                                height: '25mm',
                                                padding: '2mm 3mm',
                                                boxSizing: 'border-box',
                                                justifyContent: 'space-between',
                                                overflow: 'hidden',
                                                fontFamily: 'sans-serif'
                                            }}
                                        >
                                            <div style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1' }}>
                                                CRASOME
                                            </div>
                                            <table style={{ width: '100%', fontSize: '7px', lineHeight: '1.2', marginTop: '1px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', width: '32%', verticalAlign: 'top', padding: 0 }}>CATEGORY</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>: {item.category || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0 }}>MODEL</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>: {item.group_name || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0 }}>MRP</td>
                                                        <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap' }}>: ₹{item.mrp || 0}.00 <span style={{ fontSize: '5px' }}>(Incl. of all taxes)</span></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <div style={{ borderTop: '1px solid #000', margin: '1px 0' }}></div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                                <Barcode
                                                    value={item.group_name || 'UNKNOWN'}
                                                    width={1.3}
                                                    height={20}
                                                    displayValue={false}
                                                    margin={0}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* UI Preview showing all barcodes */}
                            {filteredData.map((item, idx) => (
                                <div
                                    key={`preview-${idx}`}
                                    className="bg-white shadow-sm border border-gray-300 flex flex-col shrink-0"
                                    style={{
                                        width: '50mm',
                                        height: '25mm',
                                        padding: '2mm 3mm',
                                        boxSizing: 'border-box',
                                        justifyContent: 'space-between',
                                        overflow: 'hidden',
                                        fontFamily: 'sans-serif',
                                        transform: 'scale(1.2)',
                                        margin: '20px'
                                    }}
                                >
                                    <div style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center', lineHeight: '1' }}>
                                        CRASOME
                                    </div>
                                    <table style={{ width: '100%', fontSize: '7px', lineHeight: '1.2', marginTop: '1px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ fontWeight: 'bold', width: '32%', verticalAlign: 'top', padding: 0 }}>CATEGORY</td>
                                                <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>: {item.category || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0 }}>MODEL</td>
                                                <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>: {item.group_name || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: 0 }}>MRP</td>
                                                <td style={{ verticalAlign: 'top', padding: 0, whiteSpace: 'nowrap' }}>: ₹{item.mrp || 0}.00 <span style={{ fontSize: '5px' }}>(Incl. of all taxes)</span></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div style={{ borderTop: '1px solid #000', margin: '1px 0' }}></div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px' }}>
                                        <Barcode
                                            value={item.group_name || 'UNKNOWN'}
                                            width={1.3}
                                            height={20}
                                            displayValue={false}
                                            margin={0}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsAllBarcodeModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded transition-colors">Cancel</button>
                            <button type="button" onClick={handlePrintAllBarcode} className="px-4 py-2 bg-[#5A5DF6] text-white text-sm font-bold rounded hover:bg-[#494ce0] transition-colors flex items-center gap-2">
                                <Scan size={16} /> Print All Barcodes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calculation;

