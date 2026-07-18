import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Layers, Loader2, Upload, UploadCloud, X, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import api from '../../services/api';

const Stock = () => {
    const [calculationData, setCalculationData] = useState([]);
    console.log("calculationData", calculationData)
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0
    });
    console.log("masterData", masterData)
    const [availableStock, setAvailableStock] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Sorting: hamesha "Different" ke hisab se sorted rahega. true = ascending (minus sabse upar), false = descending (plus sabse upar)
    const [sortByDifferent, setSortByDifferent] = useState(true);

    // Search filter — Group Name, Category, Required Stock, Available Stock, Differents sabme search karega
    const [searchTerm, setSearchTerm] = useState("");

    // --- FETCH REQUIRED STOCK DATA (Calculation.jsx jaisa hi) ---
    const fetchCalculationData = async () => {
        try {
            const response = await api.get("/getCalculationData", { params: { _t: Date.now() } });
            if (response.data && response.data.data) {
                if (response.data.data.master) setMasterData(response.data.data.master);
                if (response.data.data.items) setCalculationData(response.data.data.items);
            }
        } catch (error) {
            console.error("Error fetching calculation data:", error);
        }
    };

    // --- FETCH AVAILABLE STOCK DATA (Uploaded file se, Group Name ke basis pe match hoga) ---
    const fetchAvailableStock = async () => {
        try {
            const response = await api.get("/getStockAvailability", { params: { _t: Date.now() } });
            if (response.data && response.data.data) {
                const map = {};
                response.data.data.forEach((row) => {
                    map[row.group_name] = Number(row.available_qty) || 0;
                });
                setAvailableStock(map);
            }
        } catch (error) {
            console.error("Error fetching available stock:", error);
        }
    };

    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            await Promise.all([fetchCalculationData(), fetchAvailableStock()]);
            setIsLoading(false);
        };
        loadAll();
    }, []);

    // --- FILE UPLOAD HANDLER ---
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert("Pehle ek file select karein!");
        setIsUploading(true);
        const uploadData = new FormData();
        uploadData.append("file", selectedFile);
        try {
            const response = await api.post("/upload-stock", uploadData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            if (response.status === 201 || response.status === 200) {
                alert("Available Stock Uploaded Successfully!");
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                fetchAvailableStock();
            }
        } catch (error) {
            alert("Upload failed: " + (error.response?.data?.message || "Server error"));
        } finally {
            setIsUploading(false);
        }
    };

    // Required Stock (Final-WH) ko wahi formula se calculate karo jo Calculation.jsx me hai
    const displayData = useMemo(() => {
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;
        const bunchQty = Number(masterData.bunch_qty) || 0;

        return calculationData.map((item) => {
            const saleWh = Number(item.sale_wh) || 0;
            const availableQty = Number(item.available_qty) || 0;

            let shipWh = 0;
            if (afsDays > 0) {
                shipWh = Math.ceil(((saleWh / afsDays) * shipmentPlanDays) - availableQty);
            }

            let intWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh >= 0) {
                    if (shipWh === 0) intWh = 1;
                    else if (bunchQty > 0) intWh = Math.trunc(shipWh / bunchQty);
                    else intWh = "";
                } else intWh = "";
            }

            let decWh = "";
            if (intWh !== "") {
                if (shipWh === 0) decWh = 0;
                else if (bunchQty > 0) decWh = (shipWh / bunchQty) - intWh;
                else decWh = "";
            }

            let calculatedFinalWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh <= 0) calculatedFinalWh = "";
                else if (decWh === "") calculatedFinalWh = "";
                else calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
            }

            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            return { ...item, final_wh: displayFinalWh };
        });
    }, [calculationData, masterData.afs_days, masterData.shipment_plan_days, masterData.bunch_qty]);

    // Group Name ke basis pe grouping + SKU ke "PACK OF X" ke hisab se multiply karke sum karo
    const groupedStock = useMemo(() => {
        const groups = {};
        const groupCategories = {}; // Category ko group_name ke against Calculation data se hi store karenge

        displayData.forEach((item) => {
            const finalWh = Number(item.final_wh) || 0;
            const groupName = item.group_name || 'Unknown';

            // Category ko group ke pehle mile item se le lo (chahe finalWh 0 ho)
            if (!groupCategories[groupName] && item.category) {
                groupCategories[groupName] = item.category;
            }

            if (finalWh <= 0) return; // Blank/0 wale SKUs ko skip karo

            const packMatch = item.sku && item.sku.toUpperCase().match(/PACK OF\s*(\d+)/);
            const multiplier = packMatch ? Number(packMatch[1]) : 1;

            const effectiveQty = finalWh * multiplier;

            if (!groups[groupName]) {
                groups[groupName] = 0;
            }
            groups[groupName] += effectiveQty;
        });

        const result = Object.entries(groups).map(([groupName, totalFinalWh]) => ({
            group_name: groupName,
            final_wh: totalFinalWh,
            available_qty: availableStock[groupName] !== undefined ? availableStock[groupName] : 0,
            category: groupCategories[groupName] || '-'
        }));

        return result.map((row) => ({ ...row, different: row.available_qty - row.final_wh }));
    }, [displayData, availableStock]);

    // Hamesha "Different" ke hisab se sorted rahega — default me minus sabse upar, click karne par direction reverse ho jayegi
    const sortedStock = useMemo(() => {
        return [...groupedStock].sort((a, b) => sortByDifferent ? a.different - b.different : b.different - a.different);
    }, [groupedStock, sortByDifferent]);

    // Search filter — Group Name, Category, Required Stock, Available Stock, Differents sabme match karega
    const filteredStock = useMemo(() => {
        if (!searchTerm.trim()) return sortedStock;
        const term = searchTerm.toLowerCase();
        return sortedStock.filter((row) =>
            (row.group_name && row.group_name.toLowerCase().includes(term)) ||
            (row.category && row.category.toLowerCase().includes(term)) ||
            String(row.final_wh).toLowerCase().includes(term) ||
            String(row.available_qty).toLowerCase().includes(term) ||
            String(row.different).toLowerCase().includes(term)
        );
    }, [sortedStock, searchTerm]);

    

    return (
        <div className="h-[calc(100vh-32px)] flex flex-col space-y-3 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Stock Summary</h1>
                    <p className="text-xs text-[#1C2340]/50 mt-0.5">Required Stock (shipment plan) vs Available Stock (uploaded)</p>
                </div>
                <button
                    onClick={() => setIsUploadModalOpen(true)}
                    disabled={Object.keys(availableStock).length > 0}
                    title={Object.keys(availableStock).length > 0 ? "Stock data already uploaded. Delete old report to upload new." : "Upload Available Stock"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[11px] font-semibold shadow-sm transition-all ${Object.keys(availableStock).length > 0
                        ? 'bg-[#5A5DF6]/50 text-white cursor-not-allowed opacity-50'
                        : 'bg-[#5A5DF6] hover:bg-[#494ce0] text-white'
                        }`}
                >
                    <Upload size={12} /> Upload Available Stock
                </button>
            </div>

            <div className="relative w-full max-w-xs shrink-0">
                <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#1C2340]/40" size={14} />
                <input
                    type="text"
                    placeholder="Search by Group, Category, Stock..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[11px] border border-[#D9DDE5] rounded-[4px] focus:outline-none focus:border-[#5A5DF6] bg-white"
                />
            </div>

            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-2">
                        <Loader2 size={24} className="animate-spin text-[#5A5DF6]" />
                        <p className="text-sm text-[#1C2340]/50">Loading stock data...</p>
                    </div>
                ) : sortedStock.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-2">
                        <Layers size={32} className="text-[#1C2340]/20" />
                        <p className="text-sm text-[#1C2340]/50 font-medium">No stock data found.</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#F4F5F7] border-b border-[#D9DDE5] sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-[#1C2340]/70 uppercase tracking-wider">Group Name</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider">Category</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider">Required Stock</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider">Available Stock</th>
                                    <th
                                        onClick={() => setSortByDifferent(prev => !prev)}
                                        className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider cursor-pointer select-none hover:text-[#5A5DF6] transition-colors"
                                        title="Click to reverse sort order"
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            Differents <ArrowUpDown size={11} className="text-[#5A5DF6]" />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9DDE5]">
                                {filteredStock.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-[#F4F5F7]/60 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-[#1C2340]">{row.group_name}</td>
                                        <td className="px-4 py-3 text-center text-[#1C2340]/70">{row.category}</td>
                                        <td className="px-4 py-3 text-center font-bold text-[#5A5DF6]">{row.final_wh}</td>
                                        <td className="px-4 py-3 text-center font-bold text-[#1C2340]">{row.available_qty}</td>
                                        <td className="px-4 py-3 text-center flex items-center justify-center gap-1">
                                            {row.different < 0 ? <TrendingDown size={12} className="text-[#E74C3C]" /> : <TrendingUp size={12} className="text-[#22B573]" />}
                                            <span className={row.different < 0 ? "text-[#E74C3C] font-semibold" : "text-[#22B573] font-semibold"}>{row.different}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* UPLOAD MODAL */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#1C2340]/50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[8px] shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between">
                            <h3 className="font-bold text-[#1C2340]">Upload Available Stock</h3>
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
                                    <p className="text-[#5A5DF6] text-xs font-semibold max-w-[200px] truncate">{selectedFile.name}</p>
                                ) : (
                                    <p className="text-xs text-[#1C2340]/50 text-center">Columns: Model, Category, Owner, Req.Stock, Avg., Balance</p>
                                )}
                            </div>
                            <button type="submit" disabled={isUploading || !selectedFile} className="w-full bg-[#5A5DF6] text-white py-2.5 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#494ce0] disabled:opacity-70">
                                {isUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : "Upload"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Stock;