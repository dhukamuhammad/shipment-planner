import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, CheckCircle2, Clock, AlertCircle, Trash2, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';

const Upload = () => {
    const [reportType, setReportType] = useState('AFS Report');
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Naya state DB data ke liye
    const [recentReports, setRecentReports] = useState([]);
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

        let endpoint = "";
        if (reportType === 'AFS Report') endpoint = "/afs";
        else if (reportType === 'Business Report') endpoint = "/business";
        else if (reportType === 'DIH Report') endpoint = "/dih";
        else if (reportType === 'Transit Shipment') endpoint = "/transit";
        else return alert("Invalid report type!");

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await api.post(endpoint, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            if (response.status === 201 || response.status === 200) {
                alert(`${reportType} uploaded and saved successfully!`);
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
                        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-sm font-bold text-[#1C2340]">Select Report Type</h2>

                            {/* Report Type Selector (With Super Smooth Sliding Car Animation) */}
                            <div className="relative flex bg-[#F4F5F7] border border-[#D9DDE5] rounded-[4px] p-1 w-full sm:w-auto items-center isolation-auto">

                                {/* 🚗 Smooth Sliding Indicator Behind Tabs */}
                                <div
                                    className="absolute top-1 bottom-1 left-1 rounded-[3px] bg-white shadow-md border border-[#D9DDE5]/50 transition-all duration-500 cubic-bezier(0.25, 1, 0.5, 1)"
                                    style={{
                                        width: 'calc(25% - 2px)',
                                        transform: `translateX(${reportType === 'AFS Report' ? '0%' :
                                                reportType === 'Business Report' ? '100%' :
                                                    reportType === 'DIH Report' ? '200%' : '300%'
                                            })`
                                    }}
                                />

                                {['AFS Report', 'Business Report', 'DIH Report', 'Transit Shipment'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setReportType(type)}
                                        className={`relative z-10 flex-1 sm:flex-none w-[80px] py-1.5 text-xs font-bold rounded-[3px] text-center
                                        transition-colors duration-300 ease-in-out transform active:scale-95 origin-center
                                        ${reportType === type ? 'text-[#5A5DF6]' : 'text-[#1C2340]/50 hover:text-[#1C2340]'}`}
                                    >
                                        {type.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Drag & Drop Zone */}
                        <div
                            className="border-2 border-dashed border-[#D9DDE5] rounded-[5px] bg-[#F4F5F7]/30 hover:bg-[#F4F5F7]/80 transition-colors p-8 flex flex-col items-center justify-center cursor-pointer h-[280px]"
                            onClick={() => fileInputRef.current.click()}
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
                                Upload {reportType}
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
                        <button className="text-xs font-semibold text-[#5A5DF6] hover:underline">
                            View All
                        </button>
                    </div>

                    {/* Scrollable Container with Fixed Height */}
                    <div className="space-y-4 flex-1 overflow-y-auto pr-1 style-scrollbar">
                        {recentReports.map((report) => {
                            const { icon: StatusIcon, color } = getStatusStyle(report.status);
                            const uploadDate = new Date(report.uploaded_at).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            });

                            return (
                                <div key={report.id} className="flex items-start justify-between group p-3 hover:bg-[#F4F5F7] rounded-[5px] transition-colors border border-transparent hover:border-[#D9DDE5]/30">
                                    <div className="flex gap-3 min-w-0">
                                        <div
                                            className="w-9 h-9 rounded-[4px] flex items-center justify-center shrink-0 border border-white mt-0.5"
                                            style={{ backgroundColor: `${color}1A` }}
                                        >
                                            <FileSpreadsheet size={16} style={{ color }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-[#1C2340] truncate max-w-[120px] sm:max-w-[160px]" title={report.file_name}>
                                                {report.file_name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] font-semibold text-[#1C2340]/60 bg-[#D9DDE5]/40 px-1 py-0.2 rounded-[2px]">
                                                    {report.report_type}
                                                </span>
                                                <span className="text-[10px] text-[#1C2340]/40">
                                                    {report.file_size}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
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

                        {recentReports.length === 0 && (
                            <p className="text-xs text-center text-[#1C2340]/50 py-10">
                                No recent uploads found.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Upload
