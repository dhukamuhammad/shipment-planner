import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, FileSpreadsheet, Upload, Loader2 } from 'lucide-react';
import api from '../../services/api'; // Ensure API is imported for backend calls

const Manifest = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const manifestData = location.state?.manifestSkus || [];

    // 🔥 NAYE STATES: Template Upload ke liye
    const [hasTemplate, setHasTemplate] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const templateInputRef = useRef(null);

    // Page load hote hi check karo ki template DB me hai ya nahi
    useEffect(() => {
        checkTemplateStatus();
    }, []);

    const checkTemplateStatus = async () => {
        try {
            const res = await api.get('/check-manifest-template');
            if (res.data && res.data.exists) {
                setHasTemplate(true);
            } else {
                setHasTemplate(false);
            }
        } catch (error) {
            console.error("Failed to check template status", error);
        }
    };

    const handleTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileType", "Manifest_Template"); // Backend ko batane ke liye ki ye normal upload nahi, template hai

        setIsUploading(true);
        try {
            await api.post('/upload-template', formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            alert("Template uploaded successfully!");
            setHasTemplate(true); // Upload hote hi button disable ho jayega
        } catch (error) {
            alert("Failed to upload template. " + (error.response?.data?.message || ""));
        } finally {
            setIsUploading(false);
            if (templateInputRef.current) templateInputRef.current.value = ""; // Input ko clear karo
        }
    };

    // Total Quantity (sirf UI me dikhega, download me include nahi hoga)
    const totalQuantity = manifestData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    // --- TEMPLATE BASED EXCEL EXPORT (Backend API) ---
    const handleExportExcel = async () => {
        try {
            // Frontend se data backend bhej rahe hain file me bharne ke liye
            const response = await api.post('/download-manifest', { manifestData }, {
                responseType: 'blob' // Blob isliye kyunki binary file wapas aayegi
            });

            // Blob ko file banakar browser me download trigger karna
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Manifest_With_Template_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Export error", error);
            alert("Failed to export! Make sure you have uploaded the Manifest Template first.");
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
                    {/* 🔥 HIDDEN FILE INPUT & UPLOAD BUTTON */}
                    <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                        ref={templateInputRef}
                        onChange={handleTemplateUpload}
                    />
                    <button
                        onClick={() => templateInputRef.current.click()}
                        disabled={hasTemplate || isUploading}
                        title={hasTemplate ? "Template already uploaded. Delete it from Uploads page to add a new one." : "Upload Manifest Template"}
                        className={`flex items-center gap-2 px-4 py-2 border border-[#D9DDE5] rounded-[5px] text-xs font-semibold shadow-sm transition-all ${hasTemplate || isUploading
                            ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400'
                            : 'bg-white text-[#1C2340] hover:bg-[#F4F5F7]'
                            }`}
                    >
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} className={hasTemplate ? "text-gray-400" : "text-[#5A5DF6]"} />}
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
                        onClick={handleExportExcel}
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
        </div>
    );
};

export default Manifest;
