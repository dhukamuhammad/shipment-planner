import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Package, FileSpreadsheet, Upload, Loader2, X, UploadCloud, Scan, Eye, EyeOff, AlertCircle, MoreVertical } from 'lucide-react';
import api from '../../services/api';
import MarketplaceDropdown from '../../components/MarketplaceDropdown';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { Virtuoso } from 'react-virtuoso';

const formatFnskuTitle = (title) => {
    if (!title) return '';
    if (title.length <= 30) return title;
    const start = title.slice(0, 12);
    const end = title.slice(-18);
    return `${start} ... ${end}`;
};

const Manifest = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const manifestData = location.state?.manifestSkus || [];

    // 🔥 NAYE STATES: Template Upload ke liye
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedMarketplaceId, setSelectedMarketplaceId] = useState(location.state?.marketplace_id || "");



    // const [selectedMarketplaceId, setSelectedMarketplaceId] = useState(location.state?.marketplace_id || "");
    const [hasTemplate, setHasTemplate] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const templateInputRef = useRef(null);

    // --- Barcode Modal States ---
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [showBarcodePreview, setShowBarcodePreview] = useState(true);
    const [barcodeSize, setBarcodeSize] = useState({ width: 50, height: 25 });
    const [localBarcodeSize, setLocalBarcodeSize] = useState({ width: 50, height: 25 });
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const sizeTimeoutRef = useRef(null);

    const shipmentMode = localStorage.getItem('shipment_mode') || 'IXD';

    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

    const uniqueFCs = useMemo(() => {
        if (shipmentMode !== 'FC') return [];
        const fcs = new Set();
        manifestData.forEach(item => {
            if (item.fc) fcs.add(item.fc);
        });
        return ['All', ...Array.from(fcs)];
    }, [manifestData, shipmentMode]);

    const [activeTabFC, setActiveTabFC] = useState('All');
    useEffect(() => {
        if (shipmentMode === 'FC' && uniqueFCs.length > 0 && !activeTabFC) {
            setActiveTabFC('All');
        }
    }, [uniqueFCs, shipmentMode, activeTabFC]);

    const activeManifestData = useMemo(() => {
        if (shipmentMode === 'FC' && activeTabFC && activeTabFC !== 'All') {
            return manifestData.filter(item => item.fc === activeTabFC);
        }
        return manifestData;
    }, [manifestData, shipmentMode, activeTabFC]);

    // Calculate stats for warning message
    const barcodeStats = useMemo(() => {
        let valid = 0;
        let unknown = 0;
        activeManifestData.forEach(item => {
            const qty = parseInt(item.quantity) || 0;
            if (qty > 0) {
                const fnsku = item.fnsku || '';
                if (fnsku === '' || fnsku.toUpperCase() === 'UNKNOWN') {
                    unknown += qty;
                } else {
                    valid += qty;
                }
            }
        });
        return { valid, unknown };
    }, [activeManifestData]);

    // Generate base64 barcode images ONCE per unique FNSKU
    const barcodeImages = useMemo(() => {
        const images = {};
        const canvas = document.createElement('canvas');
        activeManifestData.forEach((item) => {
            const fnsku = item.fnsku || 'UNKNOWN';
            if (!images[fnsku]) {
                try {
                    JsBarcode(canvas, fnsku, {
                        format: "CODE128",
                        width: 2,
                        height: 60,
                        displayValue: false,
                        margin: 0,
                        background: "transparent"
                    });
                    images[fnsku] = canvas.toDataURL("image/png");
                } catch (e) {
                    console.error("JsBarcode error:", e);
                }
            }
        });
        return images;
    }, [activeManifestData]);

    // Format title for barcodes (12 chars + ... + 18 chars)
    const formatFnskuTitle = (title) => {
        if (!title) return '';
        if (title.length <= 33) return title;
        const start = title.substring(0, 12);
        const end = title.substring(title.length - 18);
        return `${start} ... ${end}`;
    };

    // Flatten all barcodes for virtualization and lazy printing
    const allBarcodesToRender = useMemo(() => {
        const flattened = [];
        activeManifestData.forEach((item, idx) => {
            const fnsku = item.fnsku || '';
            if (fnsku === '' || fnsku.toUpperCase() === 'UNKNOWN') return;
            const qty = parseInt(item.quantity) || 0;
            if (qty > 0) {
                for (let i = 0; i < qty; i++) {
                    flattened.push({ ...item, printIndex: i, originalIndex: idx });
                }
            }
        });
        return flattened;
    }, [activeManifestData]);

    // For UI Preview: chunked list by SKU with headers
    const virtualRows = useMemo(() => {
        const rows = [];
        activeManifestData.forEach((item, idx) => {
            const fnsku = item.fnsku || '';
            if (fnsku === '' || fnsku.toUpperCase() === 'UNKNOWN') return;
            const qty = parseInt(item.quantity) || 0;
            if (qty > 0) {
                rows.push({ type: 'header', item });
                const chunkedBarcodes = [];
                for (let i = 0; i < qty; i++) {
                    chunkedBarcodes.push({ ...item, printIndex: i, originalIndex: idx });
                    if (chunkedBarcodes.length === 3) {
                        rows.push({ type: 'row', items: [...chunkedBarcodes] });
                        chunkedBarcodes.length = 0;
                    }
                }
                if (chunkedBarcodes.length > 0) {
                    rows.push({ type: 'row', items: [...chunkedBarcodes] });
                }
            }
        });
        return rows;
    }, [activeManifestData]);

    useEffect(() => {
        const savedSize = localStorage.getItem('barcodeDimensions');
        if (savedSize) {
            try {
                const parsed = JSON.parse(savedSize);
                setBarcodeSize(parsed);
                setLocalBarcodeSize(parsed);
            } catch (e) { }
        }
    }, []);

    const handleBarcodeSizeChange = (e, field) => {
        const val = e.target.value;
        const newSize = { ...localBarcodeSize, [field]: val === '' ? '' : (parseInt(val) || 0) };
        setLocalBarcodeSize(newSize);

        if (sizeTimeoutRef.current) clearTimeout(sizeTimeoutRef.current);
        sizeTimeoutRef.current = setTimeout(() => {
            setBarcodeSize(newSize);
            localStorage.setItem('barcodeDimensions', JSON.stringify(newSize));
        }, 400);
    };

    const handlePrintPDF = (dataToPrint = allBarcodesToRender, isAutoSave = false, filename = "FNSKU_Barcodes.pdf") => {
        setIsGeneratingPDF(true);
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const width = parseFloat(barcodeSize.width) || 50;
                    const height = parseFloat(barcodeSize.height) || 25;

                    const doc = new jsPDF({
                        orientation: width > height ? 'landscape' : 'portrait',
                        unit: 'mm',
                        format: [width, height]
                    });

                    let pagesAdded = 0;
                    dataToPrint.forEach((item, index) => {
                        const fnsku = item.fnsku || '';
                        if (!fnsku || fnsku.toUpperCase() === 'UNKNOWN') return;

                        if (pagesAdded > 0) doc.addPage([width, height]);
                        pagesAdded++;

                        const imgData = barcodeImages[fnsku];

                        if (imgData) {
                            const imgW = width * 0.8;
                            const imgH = 9;
                            const imgX = (width - imgW) / 2;
                            doc.addImage(imgData, 'PNG', imgX, 2, imgW, imgH);
                        }

                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'bold');
                        doc.text(fnsku, width / 2, 14, { align: 'center' });

                        doc.setFontSize(6.5);
                        doc.setFont('helvetica', 'normal');
                        const title = `New - ${formatFnskuTitle(item.title)}`;
                        doc.text(title, width / 2, 18, { align: 'center' });

                        doc.setFontSize(7);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`MRP: Rs ${item.mrp || '0'} /-`, width / 2, 22, { align: 'center' });
                    });

                    if (pagesAdded > 0) {
                        if (isAutoSave) {
                            doc.save(filename);
                        } else {
                            doc.autoPrint();
                            const blob = doc.output('blob');
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                        }
                    }
                } catch (err) {
                    console.error("PDF Gen Error", err);
                }
                setIsGeneratingPDF(false);
                resolve();
            }, 50);
        });
    };


    // Replaced above

    useEffect(() => {
        const checkTemplate = async () => {
            if (!selectedMarketplaceId) {
                setHasTemplate(false);
                return;
            }
            try {
                const res = await api.get('/check-manifest-template', { params: { marketplace_id: selectedMarketplaceId } });
                setHasTemplate(res.data.exists);
            } catch (error) {
                console.error("Error checking template:", error);
                setHasTemplate(false);
            }
        };
        checkTemplate();
    }, [selectedMarketplaceId]);

    const handleTemplateUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert("Please select a file first!");
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("fileType", "Manifest_Template");
        formData.append("marketplace_id", selectedMarketplaceId);

        setIsUploading(true);
        try {
            await api.post('/upload-template', formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            alert("Template uploaded successfully!");
            setIsUploadModalOpen(false);
            setSelectedFile(null);
        } catch (error) {
            alert("Failed to upload template. " + (error.response?.data?.message || ""));
        } finally {
            setIsUploading(false);
        }
    };

    // Total Quantity (sirf UI me dikhega, download me include nahi hoga)
    const totalQuantity = activeManifestData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    // --- TEMPLATE BASED EXCEL EXPORT (Backend API) ---
    const handleExportExcel = async (e) => {
        e.preventDefault();
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsUploading(true); // Re-using loading state for export spinner
        try {
            // Frontend se data backend bhej rahe hain file me bharne ke liye
            const response = await api.post('/download-manifest', {
                manifestData: activeManifestData,
                marketplace_id: selectedMarketplaceId
            }, {
                responseType: 'blob' // Blob isliye kyunki binary file wapas aayegi
            });

            // Blob ko file banakar browser me download trigger karna
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fcName = (shipmentMode === 'FC' && activeTabFC && activeTabFC !== 'All' && activeTabFC !== 'Unassigned') ? `_${activeTabFC}` : '';
            link.download = `Manifest_${selectedMarketplaceId}${fcName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsExportModalOpen(false);

            // Naya logic: Manifest download ho gaya, toh active plan ki memory clear kardo
            localStorage.removeItem('active_calc_marketplace');
            localStorage.removeItem('active_calc_plan_id');

        } catch (error) {
            console.error("Export error", error);
            alert("Failed to export! Make sure you have uploaded the Manifest Template for this marketplace first.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadAllFcSeparately = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsUploading(true);
        try {
            for (let i = 0; i < uniqueFCs.length; i++) {
                const fc = uniqueFCs[i];
                const fcData = manifestData.filter(item => item.fc === fc);
                if (fcData.length === 0) continue;

                const response = await api.post('/download-manifest', {
                    manifestData: fcData,
                    marketplace_id: selectedMarketplaceId
                }, { responseType: 'blob' });

                const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `Manifest_${selectedMarketplaceId}_${fc}_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                await new Promise(r => setTimeout(r, 500));
            }

            setIsExportModalOpen(false);
            localStorage.removeItem('active_calc_marketplace');
            localStorage.removeItem('active_calc_plan_id');
        } catch (error) {
            console.error("Export error", error);
            alert("Failed to export all files. Make sure you have uploaded the Manifest Template.");
        } finally {
            setIsUploading(false);
        }
    };
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/calculation')}
                        className="p-2 rounded-[5px] border border-[#D9DDE5] hover:bg-[#F4F5F7] transition-colors"
                    >
                        <ArrowLeft size={16} className="text-[#1C2340]" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-[#1C2340]">Shipment Manifest</h1>
                        <p className="text-xs text-[#1C2340]/50">SKUs jinka Final-WH value zero se zyada hai</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {shipmentMode === 'FC' && uniqueFCs.length > 0 && (
                        <select
                            value={activeTabFC}
                            onChange={(e) => setActiveTabFC(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-[#D9DDE5] rounded-[5px] text-xs font-bold text-[#1C2340] outline-none focus:border-[#5A5DF6]"
                        >
                            {uniqueFCs.map(fc => (
                                <option key={fc} value={fc}>{fc === 'All' ? 'All FC' : fc}</option>
                            ))}
                        </select>
                    )}

                    {/* Total Quantity Badge — sirf display, export me include nahi */}
                    <div className="flex items-center gap-2 bg-[#5A5DF6]/10 px-3 py-2 rounded-[5px]">
                        <Package size={14} className="text-[#5A5DF6]" />
                        <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">Total Qty</span>
                        <span className="text-sm font-bold text-[#1C2340]">{totalQuantity.toLocaleString()}</span>
                    </div>

                    {/* 3-Dot Action Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                            className="p-1.5 bg-white border border-[#D9DDE5] rounded-[5px] hover:bg-[#F4F5F7] transition-colors shadow-sm"
                            title="Actions"
                        >
                            <MoreVertical size={16} className="text-[#1C2340]" />
                        </button>

                        {isActionMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#D9DDE5] rounded-[5px] shadow-lg z-50 py-1">
                                <button
                                    onClick={() => { setIsActionMenuOpen(false); setIsUploadModalOpen(true); }}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] flex items-center gap-2"
                                >
                                    <Upload size={14} className="text-[#5A5DF6]" /> {hasTemplate ? "Replace Template" : "Upload Template"}
                                </button>
                                
                                <button
                                    onClick={() => { setIsActionMenuOpen(false); setIsBarcodeModalOpen(true); }}
                                    disabled={activeManifestData.length === 0}
                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Scan size={14} className="text-[#E74C3C]" /> Print FNSKU Barcodes
                                </button>

                                <div className="h-px bg-[#D9DDE5] my-1"></div>

                                {shipmentMode === 'FC' && activeTabFC === 'All' ? (
                                    <>
                                        <button
                                            onClick={(e) => { 
                                                setIsActionMenuOpen(false);
                                                if (selectedMarketplaceId) handleExportExcel(e);
                                                else setIsExportModalOpen(true); 
                                            }}
                                            disabled={activeManifestData.length === 0}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <FileSpreadsheet size={14} className="text-[#22B573]" /> Export Mixed Manifest
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                setIsActionMenuOpen(false);
                                                if (selectedMarketplaceId) handleDownloadAllFcSeparately(e);
                                                else setIsExportModalOpen(true);
                                            }}
                                            disabled={uniqueFCs.length <= 1}
                                            className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Download size={14} className="text-[#5A5DF6]" /> Download All (Separately)
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => { 
                                            setIsActionMenuOpen(false);
                                            if (selectedMarketplaceId) handleExportExcel(e);
                                            else setIsExportModalOpen(true); 
                                        }}
                                        disabled={activeManifestData.length === 0}
                                        className="w-full text-left px-4 py-2 text-xs font-semibold text-[#1C2340] hover:bg-[#F4F5F7] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FileSpreadsheet size={14} className="text-[#22B573]" /> {shipmentMode === 'FC' ? 'Download Selected' : 'Export as Excel'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* Table Card */}
            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm overflow-hidden">
                {activeManifestData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Package size={32} className="text-[#1C2340]/20" />
                        <p className="text-sm text-[#1C2340]/50 font-medium">No SKUs found for manifest.</p>
                        <p className="text-xs text-[#1C2340]/40">Calculation page se Generate Manifest button click karke aayein.</p>
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto overflow-y-auto custom-scrollbar min-h-[300px] max-h-[89vh] bg-white">
                        <table className="w-full text-left text-xs whitespace-nowrap" style={{ tableLayout: 'auto' }}>
                            <thead className="bg-[#F4F5F7] border-b border-[#D9DDE5] sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>SKU</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>Quantity</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>FC</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>Prep Owner</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>Labeling Owner</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>Prep Category</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>HSN/SAC Code</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>GST Rate</th>
                                    <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider" style={{ overflow: 'visible', textOverflow: 'clip' }}>Declared Value (per unit)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#D9DDE5]">
                                {activeManifestData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-[#F4F5F7]/60 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-[#1C2340]" style={{ overflow: 'visible', textOverflow: 'clip' }}>
                                            <span className="bg-[#F4F5F7] border border-[#D9DDE5] px-2 py-1 rounded-[3px]">{item.sku}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-[#5A5DF6]" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.quantity}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.fc || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.prep_owner || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.labeling_owner || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.prep_category || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.hsn_sac_code || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>{item.gst_rate || '-'}</td>
                                        <td className="px-4 py-3 text-center" style={{ overflow: 'visible', textOverflow: 'clip' }}>₹{item.declared_value_per_unit || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-visible">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2">
                                <UploadCloud size={20} className="text-[#5A5DF6]" /> Upload Manifest Template
                            </h2>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleTemplateUpload} className="p-6 space-y-5">
                            <div className="z-50 relative">
                                <MarketplaceDropdown
                                    selectedId={selectedMarketplaceId}
                                    onChange={setSelectedMarketplaceId}
                                />
                            </div>

                            <div
                                className={`border-2 border-dashed border-[#D9DDE5] rounded-[5px] bg-[#F4F5F7]/30 p-8 flex flex-col items-center justify-center transition-colors ${!selectedMarketplaceId || hasTemplate ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F4F5F7]/80 cursor-pointer'}`}
                                onClick={() => {
                                    if (!selectedMarketplaceId) {
                                        alert("Please select a marketplace first!");
                                        return;
                                    }
                                    if (hasTemplate) {
                                        alert("Template already uploaded for this marketplace. Delete it from the Uploads page if you want to upload a new one.");
                                        return;
                                    }
                                    templateInputRef.current.click();
                                }}
                            >
                                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={templateInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} />
                                <div className="w-12 h-12 rounded-full bg-[#5A5DF6]/10 flex items-center justify-center mb-3"><UploadCloud size={24} className="text-[#5A5DF6]" /></div>
                                <h3 className="text-sm font-bold text-[#1C2340] mb-1">Select File</h3>
                                {hasTemplate ? (
                                    <p className="text-xs text-red-500 text-center font-semibold">Template already uploaded!</p>
                                ) : selectedFile ? (
                                    <div className="text-center">
                                        <p className="text-[#5A5DF6] text-xs font-semibold max-w-[200px] truncate">{selectedFile.name}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-[#1C2340]/50 text-center">Click to browse Template File</p>
                                )}
                            </div>
                            <button type="submit" disabled={isUploading || !selectedFile || !selectedMarketplaceId || hasTemplate} className="w-full bg-[#5A5DF6] text-white py-2.5 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#494ce0] disabled:opacity-70">
                                {isUploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : "Upload Template"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-visible">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2">
                                <FileSpreadsheet size={20} className="text-[#22B573]" /> Generate Manifest
                            </h2>
                            <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleExportExcel} className="p-6 space-y-6">
                            <div className="z-50 relative">
                                <MarketplaceDropdown
                                    selectedId={selectedMarketplaceId}
                                    onChange={setSelectedMarketplaceId}
                                />
                            </div>

                            <button type="submit" disabled={isUploading || !selectedMarketplaceId} className="w-full bg-[#22B573] text-white py-2.5 rounded-[5px] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#1e9d64] disabled:opacity-70">
                                {isUploading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : "Download Excel"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Barcode Modal */}
            {isBarcodeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh]">
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between bg-gray-50 shrink-0">
                            <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2">
                                <Scan size={20} className="text-[#E74C3C]" /> Print FNSKU Barcodes
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1 text-xs">
                                    <span className="font-semibold text-gray-600 mr-1">Dimensions:</span>
                                    <input
                                        type="number"
                                        value={localBarcodeSize.width}
                                        onChange={(e) => handleBarcodeSizeChange(e, 'width')}
                                        className="w-12 border border-gray-300 rounded px-1 text-center outline-none focus:border-[#5A5DF6]"
                                    />
                                    <span className="text-gray-500">x</span>
                                    <input
                                        type="number"
                                        value={localBarcodeSize.height}
                                        onChange={(e) => handleBarcodeSizeChange(e, 'height')}
                                        className="w-12 border border-gray-300 rounded px-1 text-center outline-none focus:border-[#5A5DF6]"
                                    />
                                    <span className="text-gray-500 text-[10px]">mm</span>
                                </div>
                                <button
                                    onClick={() => handlePrintPDF()}
                                    disabled={isGeneratingPDF}
                                    className={`text-white px-4 py-1.5 rounded-[5px] text-xs font-bold shadow-sm transition-colors flex items-center justify-center min-w-[70px] ${isGeneratingPDF ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#5A5DF6] hover:bg-[#494ce0]'}`}
                                >
                                    {isGeneratingPDF ? <Loader2 size={14} className="animate-spin" /> : 'Print'}
                                </button>
                                <button
                                    onClick={() => setShowBarcodePreview(!showBarcodePreview)}
                                    className="text-gray-500 hover:text-[#5A5DF6] transition-colors"
                                    title="Toggle Preview"
                                >
                                    {showBarcodePreview ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                                <button onClick={() => setIsBarcodeModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
                            </div>
                        </div>

                        {barcodeStats.unknown > 0 && (
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 mx-6 mt-4 text-sm text-orange-800 rounded-r shrink-0 shadow-sm">
                                <p className="font-bold flex items-center gap-2">
                                    <AlertCircle size={16} /> Attention: Missing FNSKUs
                                </p>
                                <p className="mt-1">
                                    <strong className="text-gray-900">{barcodeStats.valid}</strong> barcodes will be generated, but <strong className="text-red-600">{barcodeStats.unknown}</strong> barcodes were skipped because their FNSKU is UNKNOWN or missing.
                                </p>
                            </div>
                        )}

                        {/* UI Preview Area */}
                        <div style={{ display: showBarcodePreview ? 'block' : 'none' }} className="p-8 flex-1 overflow-hidden bg-gray-100">

                            <Virtuoso
                                data={virtualRows}
                                style={{ height: '100%', width: '100%' }}
                                itemContent={(index, row) => {
                                    if (row.type === 'header') {
                                        return (
                                            <div className="flex items-center gap-4 mt-4 mb-4 pb-2 border-b border-gray-300 px-2">
                                                <h3 className="font-bold text-gray-800 text-lg">{row.item.fnsku || 'UNKNOWN'}</h3>
                                                <span className="text-gray-500 text-sm truncate max-w-lg font-medium" title={row.item.sku}>{row.item.sku}</span>
                                                <span className="bg-[#5A5DF6]/10 text-[#5A5DF6] px-3 py-1.5 rounded text-sm font-bold border border-[#5A5DF6]/20 shadow-sm ml-auto">
                                                    Qty: {row.item.quantity}
                                                </span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="flex flex-wrap gap-6 mb-4 justify-center">
                                                {row.items.map((item) => (
                                                    <div
                                                        key={`preview-${item.originalIndex}-${item.printIndex}`}
                                                        className="flex items-center justify-center shrink-0"
                                                        style={{ width: `${(barcodeSize.width || 50) * 1.2}mm`, height: `${(barcodeSize.height || 25) * 1.2}mm` }}
                                                    >
                                                        <div
                                                            className="bg-white shadow-sm border border-gray-300 flex flex-col shrink-0"
                                                            style={{
                                                                width: `${barcodeSize.width || 50}mm`,
                                                                height: `${barcodeSize.height || 25}mm`,
                                                                padding: '2mm 3mm',
                                                                boxSizing: 'border-box',
                                                                justifyContent: 'center',
                                                                overflow: 'hidden',
                                                                fontFamily: 'sans-serif',
                                                                transform: 'scale(1.2)',
                                                                transformOrigin: 'center center'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                                {barcodeImages[item.fnsku || 'UNKNOWN'] ? (
                                                                    <img src={barcodeImages[item.fnsku || 'UNKNOWN']} alt={item.fnsku} />
                                                                ) : (
                                                                    <div style={{ height: '29.75px' }}></div>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '9px', fontWeight: 'bold', textAlign: 'center', marginTop: '1px' }}>
                                                                {item.fnsku || 'UNKNOWN'}
                                                            </div>
                                                            <div style={{ fontSize: '8.5px', textAlign: 'center', marginTop: '1px', whiteSpace: 'pre-wrap', lineHeight: '1.1' }}>
                                                                New - {formatFnskuTitle(item.title)}
                                                            </div>
                                                            <div style={{ fontSize: '9px', fontWeight: 'normal', textAlign: 'center', marginTop: '2px' }}>
                                                                MRP: ₹ {item.mrp || '0'} /-
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                }}
                            />
                        </div>

                        {!showBarcodePreview && (
                            <div className="p-10 flex flex-col items-center justify-center text-gray-400 gap-2 bg-gray-100 flex-1">
                                <EyeOff size={32} />
                                <p className="text-sm">Preview is hidden to improve performance. You can still print.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Manifest;
