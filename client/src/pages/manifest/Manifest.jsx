import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, FileSpreadsheet, Upload, Loader2, X, UploadCloud } from 'lucide-react';
import api from '../../services/api';
import MarketplaceDropdown from '../../components/MarketplaceDropdown';

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
    const totalQuantity = manifestData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    // --- TEMPLATE BASED EXCEL EXPORT (Backend API) ---
    const handleExportExcel = async (e) => {
        e.preventDefault();
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsUploading(true); // Re-using loading state for export spinner
        try {
            // Frontend se data backend bhej rahe hain file me bharne ke liye
            const response = await api.post('/download-manifest', { 
                manifestData, 
                marketplace_id: selectedMarketplaceId 
            }, {
                responseType: 'blob' // Blob isliye kyunki binary file wapas aayegi
            });

            // Blob ko file banakar browser me download trigger karna
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Manifest_${selectedMarketplaceId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsExportModalOpen(false);
        } catch (error) {
            console.error("Export error", error);
            alert("Failed to export! Make sure you have uploaded the Manifest Template for this marketplace first.");
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
                    <button
                        onClick={() => {
                            if (hasTemplate) {
                                alert("Template already uploaded for this marketplace. Delete it from the Uploads page if you want to upload a new one.");
                            } else {
                                setIsUploadModalOpen(true);
                            }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold shadow-sm transition-all rounded-[5px] border ${hasTemplate ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-[#1C2340] hover:bg-[#F4F5F7] border-[#D9DDE5]'}`}
                        title={hasTemplate ? "Template already exists. Delete it from Uploads page first." : "Upload a new template"}
                    >
                        <Upload size={14} className={hasTemplate ? "text-gray-400" : "text-[#5A5DF6]"} />
                        {hasTemplate ? "Template Uploaded" : "Upload Template"}
                    </button>

                    {/* Total Quantity Badge — sirf display, export me include nahi */}
                    <div className="flex items-center gap-2 bg-[#5A5DF6]/10 px-3 py-2 rounded-[5px]">
                        <Package size={14} className="text-[#5A5DF6]" />
                        <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">Total Qty</span>
                        <span className="text-sm font-bold text-[#1C2340]">{totalQuantity.toLocaleString()}</span>
                    </div>

                    {/* Export as Excel Button */}
                    <button
                        onClick={(e) => { 
                            if (selectedMarketplaceId) {
                                handleExportExcel(e);
                            } else {
                                setIsExportModalOpen(true); 
                            }
                        }}
                        disabled={manifestData.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[#22B573] hover:bg-[#1e9d64] text-white rounded-[5px] text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <FileSpreadsheet size={14} /> Export as Excel
                    </button>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm overflow-hidden">
                {manifestData.length === 0 ? (
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
                                {manifestData.map((item, idx) => (
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
        </div>
    );
};

export default Manifest;
