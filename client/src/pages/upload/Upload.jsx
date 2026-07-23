import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, Clock, AlertCircle, Trash2, FileSpreadsheet, Lock, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import MarketplaceDropdown from '../../components/MarketplaceDropdown';

const Upload = () => {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Marketplace state
    const [selectedMarketplaceId, setSelectedMarketplaceId] = useState("");
    const [selectedMarketplaceName, setSelectedMarketplaceName] = useState("");

    // Naya state DB data ke liye
    const [recentReports, setRecentReports] = useState([]);
    const fileInputRef = useRef(null);

    const [isViewAllOpen, setIsViewAllOpen] = useState(false);
    const [allReportsHistory, setAllReportsHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Jab View All pe click hoga, tabhi saara data mangwayenge
    const fetchAllHistory = async () => {
        setIsLoadingHistory(true);
        setIsViewAllOpen(true);
        try {
            const response = await api.get("/all-reports");
            if (response.data && response.data.data) {
                setAllReportsHistory(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    };


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
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
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
        if (!file) return alert("Pehle ek file select karein!");
        if (!selectedMarketplaceId) return alert("Please select a marketplace first!");

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("marketplace_id", selectedMarketplaceId);

        try {
            const response = await api.post("/auto", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (response.status === 201 || response.status === 200) {
                alert(`Report uploaded and saved successfully!`);
                setFile(null);

                // 🔥 UPLOAD HOTE HI LIST REFRESH KARO 🔥
                fetchRecentUploads();
            } else {
                alert("Upload failed. Please try again.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            const errorMessage = error.response?.data?.message || "Server error occurred!";
            alert("Upload failed: " + errorMessage);
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
    // 👆🔥 FUNCTION YAHAN KHATAM HOTA HAI 🔥👆



    return (
        <div className="space-y-6">
            {/* Page heading */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#1C2340]">Upload Reports</h1>
                    <p className="text-sm text-[#1C2340]/50 mt-0.5">Upload AFS, Business, and DIH reports for shipment planning</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Upload Section (Left Side) */}
                <div className="lg:col-span-2 bg-white border border-[#D9DDE5] rounded-[5px] p-6 flex flex-col justify-between h-[450px]">
                    <div>
                        {/* Marketplace Dropdown */}
                        <div className="mb-4 flex items-end gap-4">
                            <div className="flex-1">
                                <MarketplaceDropdown 
                                    selectedId={selectedMarketplaceId} 
                                    onChange={(id, name) => {
                                        setSelectedMarketplaceId(id);
                                        setSelectedMarketplaceName(name || "");
                                    }} 
                                />
                            </div>
                            {selectedMarketplaceName.toLowerCase() === "amazon" && (
                                <button className="bg-[#5A5DF6] hover:bg-[#494ce0] text-white px-4 py-[7px] rounded-[4px] text-xs font-bold flex items-center gap-2 mb-[2px] transition-colors shadow-sm whitespace-nowrap">
                                    <RefreshCw size={14} />
                                    Synchronize
                                </button>
                            )}
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
                            />
                            <div className="w-12 h-12 rounded-full bg-[#5A5DF6]/10 flex items-center justify-center mb-3">
                                <UploadCloud size={24} className="text-[#5A5DF6]" />
                            </div>
                            <h3 className="text-sm font-bold text-[#1C2340] mb-1">
                                Upload Report
                            </h3>

                            {file ? (
                                <div className="text-center mb-4">
                                    <p className="text-[#5A5DF6] text-xs font-semibold max-w-[250px] truncate">{file.name}</p>
                                    <p className="text-[11px] text-[#1C2340]/50 mt-0.5">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
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
                                    if (file) handleUploadClick();
                                    else fileInputRef.current.click();
                                }}
                                disabled={isUploading}
                            >
                                {isUploading ? "Uploading..." : file ? "Upload Now" : "Browse Files"}
                            </button>
                            <p className="text-[10px] text-[#1C2340]/40 mt-3">
                                Supported formats: .csv, .xlsx, .xls (Max 10MB)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Recent Reports List (Right Side) */}
                <div className="bg-white border border-[#D9DDE5] rounded-[5px] p-6 h-[450px] flex flex-col">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-sm font-bold text-[#1C2340]">Recent Uploads</h2>
                        <button
                            onClick={fetchAllHistory}
                            className="text-xs font-semibold text-[#5A5DF6] hover:underline"
                        >
                            View All
                        </button>
                    </div>

                    {/* Scrollable Container with Fixed Height */}
                    <div className="flex-1 overflow-y-auto pr-1 style-scrollbar space-y-6">
                        {recentReports.length === 0 ? (
                            <p className="text-xs text-center text-[#1C2340]/50 py-10">
                                No recent uploads found.
                            </p>
                        ) : (
                            <>
                                {/* 🔥 1. STANDARD REPORTS SECTION (Upar aa gaya) */}
                                {recentReports.filter(r => !['Calculation', 'Manifest_Template'].includes(r.report_type)).length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-[10px] font-bold text-[#1C2340]/50 uppercase tracking-wider border-b border-[#D9DDE5]/50 pb-1">
                                            Standard Reports
                                        </h3>
                                        {recentReports
                                            .filter(report => !['Calculation', 'Manifest_Template'].includes(report.report_type))
                                            .map((report) => {
                                                const { icon: StatusIcon, color } = getStatusStyle(report.status);
                                                const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                });

                                                return (
                                                    <div key={report.id} className="flex items-start justify-between group p-3 hover:bg-[#F4F5F7] rounded-[5px] transition-colors border border-transparent hover:border-[#D9DDE5]/30">
                                                        <div className="flex gap-3 min-w-0 w-full pr-2">
                                                            <div className="w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 border border-white mt-0.5" style={{ backgroundColor: `${color}1A` }}>
                                                                <FileSpreadsheet size={16} style={{ color }} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-[#1C2340] break-words whitespace-normal leading-tight" title={report.file_name}>
                                                                    {report.file_name}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <span className="text-[9px] font-semibold text-[#1C2340]/60 bg-[#D9DDE5]/40 px-1.5 py-0.5 rounded-[3px]">
                                                                        {report.report_type}
                                                                    </span>
                                                                    {report.marketplace && (
                                                                        <span className="text-[9px] font-bold text-[#5A5DF6] bg-[#5A5DF6]/10 px-1.5 py-0.5 rounded-[3px]">
                                                                            {report.marketplace}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] text-[#1C2340]/40">{report.file_size}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <StatusIcon size={10} style={{ color }} />
                                                                    <span className="text-[10px] font-medium" style={{ color }}>
                                                                        {report.status} • <span className="text-[#1C2340]/40">{uploadDate}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDelete(report.id)}
                                                            className="p-1.5 text-[#1C2340]/30 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[4px] transition-colors shrink-0"
                                                            title="Delete Report"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}

                                {/* 🔥 2. PROTECTED CORE FILES SECTION (Neeche aa gaya) */}
                                {recentReports.filter(r => ['Calculation', 'Manifest_Template'].includes(r.report_type)).length > 0 && (
                                    <div className="space-y-3 mt-4">
                                        <h3 className="text-[10px] font-bold text-[#E74C3C] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#D9DDE5]/50 pb-1">
                                            <Lock size={10} /> Core Files (Cannot Delete)
                                        </h3>
                                        {recentReports
                                            .filter(report => ['Calculation', 'Manifest_Template'].includes(report.report_type))
                                            .map((report) => {
                                                const { icon: StatusIcon, color } = getStatusStyle(report.status);
                                                const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                });

                                                return (
                                                    <div key={report.id} className="flex items-start justify-between group p-3 bg-[#F4F5F7]/60 rounded-[5px] border border-[#D9DDE5]/50">
                                                        <div className="flex gap-3 min-w-0 w-full pr-2">
                                                            <div className="w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 border border-white mt-0.5" style={{ backgroundColor: `${color}1A` }}>
                                                                <FileSpreadsheet size={16} style={{ color }} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-[#1C2340] break-words whitespace-normal leading-tight" title={report.file_name}>
                                                                    {report.file_name}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <span className="text-[9px] font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-1.5 py-0.5 rounded-[3px]">
                                                                        {report.report_type}
                                                                    </span>
                                                                    {report.marketplace && (
                                                                        <span className="text-[9px] font-bold text-[#5A5DF6] bg-[#5A5DF6]/10 px-1.5 py-0.5 rounded-[3px]">
                                                                            {report.marketplace}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] text-[#1C2340]/40">{report.file_size}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <StatusIcon size={10} style={{ color }} />
                                                                    <span className="text-[10px] font-medium" style={{ color }}>
                                                                        {report.status} • <span className="text-[#1C2340]/40">{uploadDate}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Safety Locked Delete Button with Password */}
                                                        <button
                                                            onClick={() => handleProtectedDelete(report.id, report.report_type)}
                                                            className="p-1.5 text-[#1C2340]/40 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[4px] transition-colors shrink-0"
                                                            title="Unlock & Delete Protected File"
                                                        >
                                                            <Lock size={14} className="group-hover:hidden" />
                                                            <Trash2 size={14} className="hidden group-hover:block text-[#E74C3C]" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}

                                {/* 🔥 VIEW ALL REPORTS MODAL 🔥 */}
                                {isViewAllOpen && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2340]/60 backdrop-blur-sm p-4">
                                        <div className="bg-white rounded-[8px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                            {/* Modal Header */}
                                            <div className="px-6 py-4 border-b border-[#D9DDE5] flex justify-between items-center bg-[#F9FAFB] rounded-t-[8px]">
                                                <div>
                                                    <h3 className="font-bold text-[#1C2340] text-lg">All Uploaded Reports</h3>
                                                    <p className="text-xs text-[#1C2340]/50">Complete history of your uploaded files</p>
                                                </div>
                                                <button onClick={() => setIsViewAllOpen(false)} className="text-[#1C2340]/40 hover:text-[#E74C3C] transition-colors p-1 bg-white rounded-md shadow-sm border border-[#D9DDE5]">
                                                    {/* Agar close icon nahi chal raha to lucide-react se 'X' import kar lena */}
                                                    ✕
                                                </button>
                                            </div>

                                            {/* Modal Body (Scrollable Table) */}
                                            <div className="flex-1 overflow-y-auto p-6 bg-white style-scrollbar">
                                                {isLoadingHistory ? (
                                                    <div className="flex justify-center items-center h-40 text-[#5A5DF6] font-semibold text-sm">
                                                        Loading history...
                                                    </div>
                                                ) : (
                                                    <table className="w-full text-left border-collapse">
                                                        <thead className="bg-[#F4F5F7] sticky top-0 z-10 shadow-sm">
                                                            <tr>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase">File Name</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase">Marketplace</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase">Report Type</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase">Size</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase">Date & Time</th>
                                                                <th className="px-4 py-3 text-xs font-bold text-[#1C2340]/70 uppercase text-center">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#D9DDE5]">
                                                            {allReportsHistory.map((report) => {
                                                                const { icon: StatusIcon, color } = getStatusStyle(report.status);
                                                                const isProtected = ['Calculation', 'Manifest_Template'].includes(report.report_type);
                                                                const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                });

                                                                return (
                                                                    <tr key={report.id} className={`hover:bg-[#F4F5F7]/50 transition-colors ${isProtected ? 'bg-red-50/20' : ''}`}>
                                                                        <td className="px-4 py-3 flex items-center gap-3">
                                                                            <FileSpreadsheet size={16} style={{ color }} />
                                                                            <span className="text-sm font-semibold text-[#1C2340]">{report.file_name}</span>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            {report.marketplace ? (
                                                                                <span className="text-[10px] font-bold px-2 py-1 rounded-[3px] bg-[#5A5DF6]/10 text-[#5A5DF6]">
                                                                                    {report.marketplace}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-[#1C2340]/40">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-[3px] ${isProtected ? 'bg-[#E74C3C]/10 text-[#E74C3C]' : 'bg-[#D9DDE5]/40 text-[#1C2340]/60'}`}>
                                                                                {report.report_type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 text-xs text-[#1C2340]/60">{report.file_size}</td>
                                                                        <td className="px-4 py-3 text-xs text-[#1C2340]/60">{uploadDate}</td>
                                                                        <td className="px-4 py-3 text-center">
                                                                            {isProtected ? (
                                                                                <button onClick={() => {
                                                                                    handleProtectedDelete(report.id, report.report_type);
                                                                                    setIsViewAllOpen(false); // Delete ke baad modal band karein (optional)
                                                                                }} className="p-1.5 text-[#1C2340]/40 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[4px]" title="Unlock & Delete">
                                                                                    <Lock size={14} />
                                                                                </button>
                                                                            ) : (
                                                                                <button onClick={() => {
                                                                                    handleDelete(report.id);
                                                                                    setIsViewAllOpen(false);
                                                                                }} className="p-1.5 text-[#1C2340]/40 hover:text-[#E74C3C] hover:bg-[#E74C3C]/10 rounded-[4px]" title="Delete Report">
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Upload
