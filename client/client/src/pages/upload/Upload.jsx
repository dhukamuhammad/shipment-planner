import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle2, Clock, AlertCircle, Trash2, FileSpreadsheet, Lock, Plus } from 'lucide-react';
import api from '../../services/api';
import MarketplaceDropdown from '../../components/MarketplaceDropdown';

const Upload = () => {
    const navigate = useNavigate();
    const [isCreateNewOpen, setIsCreateNewOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    // Marketplace state
    const [selectedMarketplaceId, setSelectedMarketplaceId] = useState("");
    const [showGoToCalc, setShowGoToCalc] = useState(false);
    const [validationError, setValidationError] = useState(null);
    // Smart Upload Results Modal
    const [uploadResults, setUploadResults] = useState(null); // null = closed, array = open

    // Naya state DB data ke liye
    const [recentReports, setRecentReports] = useState([]);
    const [selectedReports, setSelectedReports] = useState(new Set());
    const fileInputRef = useRef(null);

    // API call function
    const fetchRecentUploads = async () => {
        try {
            // Yahan '/recent' call kar rahe hain
            const response = await api.get("/recent");
            if (response.data && response.data.data) {
                setRecentReports(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching recent uploads:", error);
        }
    };

    // Jab page pehli baar load ho, toh reports fetch karega
    useEffect(() => {
        fetchRecentUploads();
    }, []);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(Array.from(e.target.files));
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Success': return { icon: CheckCircle2, color: '#22B573' };
            case 'Failed': return { icon: AlertCircle, color: '#E74C3C' };
            case 'Processing':
            case 'Pending': return { icon: Clock, color: '#F4C542' };
            default: return { icon: FileText, color: '#5A5DF6' };
        }
    };

    const handleUploadClick = async () => {
        if (files.length === 0) return alert("Pehle files select karein!");
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsUploading(true);
        // Per-file result tracking
        const results = [];

        try {
            for (const f of files) {
                const formData = new FormData();
                formData.append("file", f);
                formData.append("marketplace_id", selectedMarketplaceId);
                const currentMode = localStorage.getItem('shipment_mode') || 'IXD';
                formData.append("shipment_mode", currentMode);

                try {
                    const response = await api.post("/auto", formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });

                    if (response.status === 201 || response.status === 200) {
                        const reportType = response.data?.data?.reportType || response.data?.message || "Upload";
                        results.push({
                            fileName: f.name,
                            status: 'success',
                            detail: response.data?.message || "Successfully uploaded",
                        });
                    } else {
                        results.push({
                            fileName: f.name,
                            status: 'fail',
                            detail: response.data?.message || "Unknown error",
                        });
                    }
                } catch (fileError) {
                    // Per-file error capture karo - ek file fail hone par doosri continue karegi
                    const errMsg = fileError.response?.data?.message || fileError.message || "Server error";
                    results.push({
                        fileName: f.name,
                        status: 'fail',
                        detail: errMsg,
                    });
                }
            }

            const successCount = results.filter(r => r.status === 'success').length;

            // Results modal show karo
            setUploadResults(results);

            if (successCount > 0) {
                setFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
                fetchRecentUploads();
                setShowGoToCalc(true);
            }
        } catch (error) {
            console.error("Upload error:", error);
            setUploadResults([{ fileName: 'Unknown', status: 'fail', detail: error.message || "Server error occurred!" }]);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id) => {
        // Delete karne se pehle user se confirmation zaroor lein
        const confirmDelete = window.confirm("Are you sure you want to delete this report? Iska saara data dashboard se hat jayega.");
        if (!confirmDelete) return;

        try {
            // Yahan hum DELETE request bhej rahe hain
            const response = await api.delete(`/${id}`);

            if (response.status === 200) {
                // UI se turant report hatane ke liye recentReports state ko update karein
                setRecentReports((prevReports) => prevReports.filter(report => report.id !== id));
                // Optional: success alert bhi de sakte hain
                // alert("Report deleted successfully!");
            }
        } catch (error) {
            console.error("Error deleting report:", error);
            alert("Failed to delete report. Please try again.");
        }
    };

    // 👇🔥 PASSWORD PROTECTED DELETE FUNCTION 🔥👇
    const handleProtectedDelete = async (id, reportType) => {
        // 1. User se password mangna
        const enteredPassword = window.prompt(
            `⚠️ RESTRICTED ACTION: Protected File (${reportType})\n\n` +
            `Is file ko delete karne ke liye Admin Password enter karein:`
        );

        // Agar user cancel par click kare ya khali submit kare
        if (enteredPassword === null || enteredPassword.trim() === "") {
            return;
        }

        // 2. 🔐 YAHAN APNA SECRET PASSWORD SET KAREIN 🔐
        const ADMIN_PASSWORD = "admin"; // <--- "admin" ki jagah apna koi bhi password rakh lein

        // 3. Password Check
        if (enteredPassword !== ADMIN_PASSWORD) {
            alert("❌ Incorrect Password! Aap is file ko delete nahi kar sakte.");
            return; // Galat password pe yahi se wapas bhej dega
        }

        // 4. Password sahi hone par final confirmation
        const confirmDelete = window.confirm("✅ Password Verified! Kya aap sach me ise permanently delete karna chahte hain?");
        if (!confirmDelete) return;

        try {
            const response = await api.delete(`/${id}`);
            if (response.status === 200) {
                setRecentReports((prevReports) => prevReports.filter(report => report.id !== id));
                alert("Protected report successfully deleted!");
            }
        } catch (error) {
            console.error("Error deleting protected report:", error);
            alert("Failed to delete protected report. Please try again.");
        }
    };

    // --- BULK DELETE ---
    const standardReports = recentReports.filter(r => !['Calculation', 'Manifest_Template'].includes(r.report_type));

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedReports(new Set(standardReports.map(r => r.id)));
        } else {
            setSelectedReports(new Set());
        }
    };

    const handleSelectOne = (id, checked) => {
        setSelectedReports(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedReports.size === 0) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedReports.size} report(s)?`);
        if (!confirmDelete) return;
        try {
            await Promise.all([...selectedReports].map(id => api.delete(`/${id}`)));
            setRecentReports(prev => prev.filter(r => !selectedReports.has(r.id)));
            setSelectedReports(new Set());
        } catch (error) {
            alert('Failed to delete some reports. Please try again.');
        }
    };


    const handleGoToCalc = () => {
        // Validation to ensure they don't proceed to calculation without the required files
        const uploadedTypes = recentReports.map(r => r.report_type);
        const hasAFS = uploadedTypes.includes('AFS');
        const hasDIH = uploadedTypes.includes('DIH');
        const hasStock = uploadedTypes.includes('Stock') || uploadedTypes.includes('Business');

        if (!hasAFS || !hasDIH || !hasStock) {
            const missing = [];
            if (!hasAFS) missing.push("AFS");
            if (!hasDIH) missing.push("DIH");
            if (!hasStock) missing.push("Available Stock");

            setValidationError(missing);
            return;
        }
        navigate(`/calculation?marketplace_id=${selectedMarketplaceId}&auto_load=true`);
    };

    return (
        <div className="space-y-6">
            {/* Page heading */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1C2340]">Upload Reports</h1>
                    <p className="text-sm text-[#1C2340]/50 mt-0.5">Upload AFS, Business, and DIH reports for shipment planning</p>
                </div>
                <div className="flex items-center gap-3">
                    {showGoToCalc && (
                        <button 
                            onClick={handleGoToCalc}
                            className="flex items-center gap-2 bg-white border border-[#D9DDE5] hover:bg-[#F4F5F7] text-[#1C2340] px-5 py-2.5 rounded-[5px] text-sm font-semibold transition-colors shadow-sm"
                        >
                            Go to Calculation
                        </button>
                    )}
                    <button 
                        onClick={() => setIsCreateNewOpen(!isCreateNewOpen)}
                        className="flex items-center gap-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white px-5 py-2.5 rounded-[5px] text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        {isCreateNewOpen ? "Cancel Creation" : "Create Shipment "}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Upload Section (Left Side) */}
                <div className={`lg:col-span-2 transition-all ${isCreateNewOpen ? 'block' : 'hidden lg:block opacity-50 pointer-events-none'}`}>
                    <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6 flex flex-col justify-between h-[450px] relative">
                        {!isCreateNewOpen && (
                            <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                                <div className="text-center p-4">
                                    <p className="text-[#1C2340] font-bold mb-2">Create New Plan</p>
                                    <p className="text-sm text-[#1C2340]/60">Click the button above to start a new shipment plan.</p>
                                </div>
                            </div>
                        )}
                        <div className={isCreateNewOpen ? '' : 'opacity-30'}>
                        {/* Marketplace Dropdown & Mode Toggle */}
                        <div className="mb-4 flex flex-col gap-3">
                            <MarketplaceDropdown 
                                selectedId={selectedMarketplaceId} 
                                onChange={setSelectedMarketplaceId} 
                            />
                        </div>

                        {/* Drag & Drop Zone */}
                        <div
                            className={`border-2 border-dashed border-[#D9DDE5] rounded-[5px] bg-[#F4F5F7]/30 transition-colors p-6 flex flex-col items-center justify-center h-full ${!selectedMarketplaceId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#F4F5F7]/80 cursor-pointer'}`}
                            onClick={() => {
                                if (!selectedMarketplaceId) {
                                    alert("Please select a marketplace first!");
                                    return;
                                }
                                fileInputRef.current.click();
                            }}
                        >
                            {/* Hidden file input */}
                            <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                multiple
                            />
                            <div className="w-12 h-12 rounded-full bg-[#5A5DF6]/10 flex items-center justify-center mb-3">
                                <UploadCloud size={24} className="text-[#5A5DF6]" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C2340] mb-1">
                                Upload Report
                            </h3>

                            {files.length > 0 ? (
                                <div className="text-center mb-4">
                                    <p className="text-[#5A5DF6] text-xs font-semibold max-w-[250px] truncate">{files.length} file(s) selected</p>
                                    <p className="text-[11px] text-[#1C2340]/50 mt-0.5">Click to browse again</p>
                                </div>
                            ) : (
                                <p className="text-xs text-[#1C2340]/50 text-center mb-4 max-w-xs">
                                    Drag and drop your CSV or Excel file here, or click to browse.
                                </p>
                            )}

                            <button
                                className={`${isUploading ? 'bg-[#D9DDE5] text-[#1C2340]/50 cursor-not-allowed' : 'bg-[#5A5DF6] hover:bg-[#494ce0] text-white'} px-5 py-2 text-xs font-semibold rounded-[4px] transition-colors shadow-sm`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!selectedMarketplaceId) {
                                        alert("Please select a marketplace first!");
                                        return;
                                    }
                                    if (files.length > 0) handleUploadClick();
                                    else fileInputRef.current.click();
                                }}
                                disabled={isUploading}
                            >
                                {isUploading ? "Uploading..." : files.length > 0 ? "Upload Now" : "Browse Files"}
                            </button>
                            <p className="text-[10px] text-[#1C2340]/40 mt-3">
                                Supported formats: .csv, .xlsx, .xls (Max 10MB)
                            </p>
                        </div>
                    </div>
                </div>
                </div>

                {/* Recent Reports List (Right Side) */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6 h-[450px] flex flex-col">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <h2 className="text-sm font-bold text-[#1C2340]">Recent Uploads</h2>
                        {selectedReports.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#E74C3C] hover:bg-[#c0392b] rounded-[4px] transition-colors"
                            >
                                <Trash2 size={12} />
                                Delete ({selectedReports.size})
                            </button>
                        )}
                    </div>

                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                        {recentReports.length === 0 ? (
                            <p className="text-xs text-center text-[#1C2340]/50 py-10">No recent uploads found.</p>
                        ) : (
                            <>
                                {/* STANDARD REPORTS */}
                                {standardReports.length > 0 && (
                                    <div>
                                        {/* Section header with Select All */}
                                        <div className="flex items-center justify-between border-b border-[#D9DDE5]/50 pb-1 mb-2">
                                            <h3 className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider">Standard Reports</h3>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-3 h-3 accent-[#5A5DF6] cursor-pointer"
                                                    checked={selectedReports.size === standardReports.length && standardReports.length > 0}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                />
                                                <span className="text-[10px] text-[#1C2340]/50 font-medium">Select All</span>
                                            </label>
                                        </div>

                                        <div className="space-y-1">
                                            {standardReports.map((report) => {
                                                const { icon: StatusIcon, color } = getStatusStyle(report.status);
                                                const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                });
                                                const isSelected = selectedReports.has(report.id);

                                                return (
                                                    <div
                                                        key={report.id}
                                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-[5px] transition-colors group border ${
                                                            isSelected ? 'bg-[#5A5DF6]/5 border-[#5A5DF6]/20' : 'border-transparent hover:bg-[#F4F5F7] hover:border-[#D9DDE5]/30'
                                                        }`}
                                                    >
                                                        {/* Checkbox */}
                                                        <input
                                                            type="checkbox"
                                                            className="w-3 h-3 accent-[#5A5DF6] cursor-pointer shrink-0"
                                                            checked={isSelected}
                                                            onChange={(e) => handleSelectOne(report.id, e.target.checked)}
                                                        />
                                                        {/* File Icon */}
                                                        <div className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A` }}>
                                                            <FileSpreadsheet size={12} style={{ color }} />
                                                        </div>
                                                        {/* Filename — truncated */}
                                                        <p className="text-[11px] font-semibold text-[#1C2340] truncate flex-1 min-w-0" title={report.file_name}>
                                                            {report.file_name}
                                                        </p>
                                                        {/* Report type badge */}
                                                        <span className="text-[9px] font-semibold text-[#1C2340]/60 bg-[#D9DDE5]/40 px-1.5 py-0.5 rounded-[3px] shrink-0">
                                                            {report.report_type}
                                                        </span>
                                                        {/* Marketplace badge */}
                                                        {report.marketplace && (
                                                            <span className="text-[9px] font-bold text-[#5A5DF6] bg-[#5A5DF6]/10 px-1.5 py-0.5 rounded-[3px] shrink-0">
                                                                {report.marketplace}
                                                            </span>
                                                        )}
                                                        {/* Size */}
                                                        <span className="text-[9px] text-[#1C2340]/40 shrink-0">{report.file_size}</span>
                                                        {/* Status + date */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <StatusIcon size={10} style={{ color }} />
                                                            <span className="text-[9px] font-medium whitespace-nowrap" style={{ color }}>{report.status}</span>
                                                            <span className="text-[9px] text-[#1C2340]/40 whitespace-nowrap">• {uploadDate}</span>
                                                        </div>
                                                        {/* Delete button */}
                                                        <button
                                                            onClick={() => handleDelete(report.id)}
                                                            className="p-1 text-[#1C2340]/30 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[3px] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* CORE FILES */}
                                {recentReports.filter(r => ['Calculation', 'Manifest_Template'].includes(r.report_type)).length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-1.5 border-b border-[#D9DDE5]/50 pb-1 mb-2">
                                            <Lock size={9} className="text-[#E74C3C]" />
                                            <h3 className="text-[10px] font-bold text-[#E74C3C] uppercase tracking-wider">Core Files (Cannot Delete)</h3>
                                        </div>
                                        <div className="space-y-1">
                                            {recentReports
                                                .filter(r => ['Calculation', 'Manifest_Template'].includes(r.report_type))
                                                .map((report) => {
                                                    const { icon: StatusIcon, color } = getStatusStyle(report.status);
                                                    const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    });
                                                    return (
                                                        <div key={report.id} className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] bg-[#F4F5F7]/60 border border-[#D9DDE5]/50 group">
                                                            {/* Spacer for checkbox alignment */}
                                                            <div className="w-3 shrink-0" />
                                                            {/* File Icon */}
                                                            <div className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1A` }}>
                                                                <FileSpreadsheet size={12} style={{ color }} />
                                                            </div>
                                                            {/* Filename */}
                                                            <p className="text-[11px] font-semibold text-[#1C2340] truncate flex-1 min-w-0" title={report.file_name}>
                                                                {report.file_name}
                                                            </p>
                                                            {/* Report type badge */}
                                                            <span className="text-[9px] font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-1.5 py-0.5 rounded-[3px] shrink-0">
                                                                {report.report_type}
                                                            </span>
                                                            {/* Marketplace */}
                                                            {report.marketplace && (
                                                                <span className="text-[9px] font-bold text-[#5A5DF6] bg-[#5A5DF6]/10 px-1.5 py-0.5 rounded-[3px] shrink-0">
                                                                    {report.marketplace}
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] text-[#1C2340]/40 shrink-0">{report.file_size}</span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <StatusIcon size={10} style={{ color }} />
                                                                <span className="text-[9px] font-medium whitespace-nowrap" style={{ color }}>{report.status}</span>
                                                                <span className="text-[9px] text-[#1C2340]/40 whitespace-nowrap">• {uploadDate}</span>
                                                            </div>
                                                            {/* Protected delete */}
                                                            <button
                                                                onClick={() => handleProtectedDelete(report.id, report.report_type)}
                                                                className="p-1 text-[#1C2340]/30 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[3px] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                                                                title="Unlock & Delete"
                                                            >
                                                                <Lock size={12} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Validation Modal */}
            {validationError && (
                <div className="fixed inset-0 bg-[#1C2340]/20 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[8px] shadow-xl border border-[#D9DDE5] w-full max-w-[320px] p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 text-[#E74C3C] mb-3">
                            <AlertCircle size={20} />
                            <h3 className="text-lg font-bold">File Missing</h3>
                        </div>
                        <p className="text-sm text-[#1C2340]/80 mb-3">
                            Please add these missing files to your selection:
                        </p>
                        <ul className="text-sm font-semibold text-[#1C2340] space-y-1 mb-6 ml-5 list-disc marker:text-[#E74C3C]">
                            {validationError.map((file) => (
                                <li key={file}>{file}</li>
                            ))}
                        </ul>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setValidationError(null)}
                                className="bg-[#1C2340] hover:bg-[#2b3560] text-white px-6 py-2 rounded-[5px] text-sm font-semibold transition-colors shadow-sm"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Smart Upload Results Modal */}
            {uploadResults && (
                <div className="fixed inset-0 bg-[#1C2340]/30 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[10px] shadow-2xl border border-[#D9DDE5] w-full max-w-[480px] overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-[#D9DDE5] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UploadCloud size={18} className="text-[#5A5DF6]" />
                                <h3 className="text-sm font-bold text-[#1C2340]">Upload Results</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-[#22B573] bg-[#22B573]/10 px-2 py-0.5 rounded-full">
                                    ✅ {uploadResults.filter(r => r.status === 'success').length} Success
                                </span>
                                {uploadResults.filter(r => r.status === 'fail').length > 0 && (
                                    <span className="text-[11px] font-semibold text-[#E74C3C] bg-[#E74C3C]/10 px-2 py-0.5 rounded-full">
                                        ❌ {uploadResults.filter(r => r.status === 'fail').length} Failed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Results List */}
                        <div className="px-6 py-4 space-y-3 max-h-[320px] overflow-y-auto">
                            {uploadResults.map((result, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-[6px] border p-3 ${
                                        result.status === 'success'
                                            ? 'bg-[#22B573]/5 border-[#22B573]/20'
                                            : 'bg-[#E74C3C]/5 border-[#E74C3C]/20'
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        {result.status === 'success' ? (
                                            <CheckCircle2 size={14} className="text-[#22B573] mt-0.5 shrink-0" />
                                        ) : (
                                            <AlertCircle size={14} className="text-[#E74C3C] mt-0.5 shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            {/* File name */}
                                            <p
                                                className="text-[11px] font-bold text-[#1C2340] truncate"
                                                title={result.fileName}
                                            >
                                                {result.fileName}
                                            </p>
                                            {/* Detail / Error reason */}
                                            <p
                                                className={`text-[10px] mt-0.5 leading-relaxed break-words ${
                                                    result.status === 'success'
                                                        ? 'text-[#22B573]'
                                                        : 'text-[#E74C3C]'
                                                }`}
                                            >
                                                {result.detail}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-[#D9DDE5] flex justify-end">
                            <button
                                onClick={() => setUploadResults(null)}
                                className="bg-[#1C2340] hover:bg-[#2b3560] text-white px-6 py-2 rounded-[5px] text-sm font-semibold transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Upload
