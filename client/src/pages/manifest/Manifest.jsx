import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Package, ChevronDown, FileSpreadsheet, FileText, FileType } from 'lucide-react';

const Manifest = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const manifestData = location.state?.manifestSkus || [];

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef(null);

    // Bahar click karne pe export menu band karo
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Total Quantity (sirf UI me dikhega, download me include nahi hoga)
    const totalQuantity = manifestData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

    // Export ke liye common headers/rows (Total Quantity yahan include nahi hai)
    const exportHeaders = ["Merchant SKU", "Quantity", "FC", "Prep owner", "Labeling owner", "Prep category", "HSN/SAC code", "GST rate", "Declared value(per unit)"];
    const getExportRows = () => manifestData.map(item => [
        item.sku, item.quantity, item.fc,
        item.prep_owner, item.labeling_owner, item.prep_category,
        item.hsn_sac_code, item.gst_rate, item.declared_value_per_unit
    ]);

    // --- CSV EXPORT ---
    const handleExportCSV = () => {
        const rows = getExportRows();
        let csvContent = exportHeaders.join(",") + "\n";
        rows.forEach(row => {
            csvContent += row.map(val => `"${val ?? ''}"`).join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Manifest_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportMenuOpen(false);
    };

    // --- EXCEL EXPORT (xlsx library) ---
    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const rows = getExportRows();
        const wsData = [exportHeaders, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // NAYA FIX: Column widths ko content ke hisab se automatically calculate karo
        const colWidths = exportHeaders.map((header, colIndex) => {
            let maxLength = header.length; // Pehle header ki length le lo

            // Har row me is column ki value check karo ki kitni lambi hai
            rows.forEach((row) => {
                const val = row[colIndex];
                const valLength = val !== null && val !== undefined ? String(val).length : 0;
                if (valLength > maxLength) {
                    maxLength = valLength;
                }
            });

            // Max width 50 chars tak rakhte hain, aur thodi padding (+2) de dete hain
            return { wch: Math.min(maxLength + 2, 50) };
        });

        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Manifest");
        XLSX.writeFile(wb, `Manifest_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setIsExportMenuOpen(false);
    };

    // --- PDF EXPORT (jspdf + jspdf-autotable) ---
    const handleExportPDF = async () => {
        const { jsPDF } = await import('jspdf');
        const autoTableModule = await import('jspdf-autotable');
        const autoTable = autoTableModule.default;

        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("Shipment Manifest", 14, 15);

        autoTable(doc, {
            head: [exportHeaders],
            body: getExportRows(),
            startY: 20,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [90, 93, 246] }
        });

        doc.save(`Manifest_${new Date().toISOString().slice(0, 10)}.pdf`);
        setIsExportMenuOpen(false);
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
                    {/* Total Quantity Badge — sirf display, export me include nahi */}
                    <div className="flex items-center gap-2 bg-[#5A5DF6]/10 px-3 py-2 rounded-[5px]">
                        <Package size={14} className="text-[#5A5DF6]" />
                        <span className="text-[11px] font-bold text-[#5A5DF6] uppercase tracking-wider">Total Qty</span>
                        <span className="text-sm font-bold text-[#1C2340]">{totalQuantity.toLocaleString()}</span>
                    </div>

                    {/* Export Dropdown */}
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setIsExportMenuOpen(prev => !prev)}
                            disabled={manifestData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-[#5A5DF6] hover:bg-[#494ce0] text-white rounded-[5px] text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={14} /> Export <ChevronDown size={14} />
                        </button>

                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-44 bg-white border border-[#D9DDE5] rounded-[5px] shadow-lg z-999 overflow-hidden">
                                <button onClick={handleExportCSV} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#1C2340] hover:bg-[#F4F5F7] transition-colors">
                                    <FileText size={14} className="text-[#5A5DF6]" /> Export as CSV
                                </button>
                                <button onClick={handleExportExcel} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#1C2340] hover:bg-[#F4F5F7] transition-colors">
                                    <FileSpreadsheet size={14} className="text-[#22B573]" /> Export as Excel
                                </button>
                                <button onClick={handleExportPDF} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[#1C2340] hover:bg-[#F4F5F7] transition-colors">
                                    <FileType size={14} className="text-[#E74C3C]" /> Export as PDF
                                </button>
                            </div>
                        )}
                    </div>
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