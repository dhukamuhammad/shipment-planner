import React, { useState, useEffect, useMemo } from 'react';
import { Package, Loader2, Plus, Minus, Scale, Download, FileText, FileSpreadsheet, Truck } from 'lucide-react';
import api from '../../services/api';

const BagAccordion = ({ bag }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm overflow-hidden mb-3">
            <div 
                className="bg-[#F4F5F7] px-5 py-3 flex justify-between items-center cursor-pointer hover:bg-[#EAECEF] transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-[#1C2340] flex items-center gap-2">
                        <Package size={18} className="text-[#5A5DF6]" />
                        Bag {bag.id}
                        <span className="text-[11px] font-medium text-[#1C2340]/50 ml-1">({bag.type})</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full ml-1 tracking-wide">
                            {bag.items.length} SKUs
                        </span>
                    </h2>
                    <span className="text-xs font-semibold text-[#1C2340]/60 bg-[#D9DDE5]/50 px-2 py-1 rounded">
                        {bag.totalQty} items
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded" title="Actual Weight">
                            <Scale size={14} />
                            {bag.totalWeight.toFixed(2)} kg
                        </span>
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded" title="Rounded Weight">
                            ~{Math.round(bag.totalWeight)} kg
                        </span>
                    </div>
                </div>
                {isOpen ? (
                    <Minus size={20} className="text-[#1C2340]/60" />
                ) : (
                    <Plus size={20} className="text-[#1C2340]/60" />
                )}
            </div>
            
            {isOpen && (
                <div className="overflow-x-auto border-t border-[#D9DDE5]">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#F9FAFB]">
                            <tr className="border-b border-[#D9DDE5]">
                                <th className="px-5 py-3 font-bold text-[#1C2340] uppercase tracking-wider">Group Name</th>
                                <th className="px-5 py-3 font-bold text-[#1C2340] uppercase tracking-wider">SKU</th>
                                <th className="px-5 py-3 font-bold text-[#1C2340] uppercase tracking-wider">Category</th>
                                <th className="px-5 py-3 text-right font-bold text-[#1C2340] uppercase tracking-wider">Quantity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9DDE5]/40">
                            {bag.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-[#F4F5F7]/40 transition-colors">
                                    <td className="px-5 py-2.5 font-medium text-[#1C2340]">{item.group_name || '-'}</td>
                                    <td className="px-5 py-2.5 text-[#1C2340]">{item.sku || '-'}</td>
                                    <td className="px-5 py-2.5 text-[#1C2340]/80">{item.category || '-'}</td>
                                    <td className="px-5 py-2.5 text-right font-bold text-[#5A5DF6]">{item.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const Boxes = () => {
    const [calculationData, setCalculationData] = useState([]);
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [useSuggestedWh, setUseSuggestedWh] = useState(false);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const storedData = sessionStorage.getItem('boxes_calculation_data');
                if (storedData) {
                    const parsed = JSON.parse(storedData);
                    if (parsed.master && parsed.items && parsed.items.length > 0) {
                        setMasterData(parsed.master);
                        setCalculationData(parsed.items);
                    }
                }
                
                // Fallback to API if no data in sessionStorage
                if (!storedData || JSON.parse(storedData).items.length === 0) {
                    const response = await api.get("/getCalculationData", { params: { _t: Date.now() } });
                    if (response.data && response.data.data) {
                        if (response.data.data.master) setMasterData(response.data.data.master);
                        if (response.data.data.items) setCalculationData(response.data.data.items);
                    }
                }
                
                const settingsRes = await api.get("/settings");
                if (settingsRes.data?.success && settingsRes.data?.data) {
                    setUseSuggestedWh(settingsRes.data.data.use_suggested_wh === '1');
                }
            } catch (error) {
                console.error("Error fetching boxes data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const displayData = useMemo(() => {
        const afsDays = Number(masterData.afs_days) || 0;
        const shipmentPlanDays = Number(masterData.shipment_plan_days) || 0;
        const bunchQty = Number(masterData.bunch_qty) || 0;

        const processedData = calculationData.map((item) => {
            // --- Final WH logic ---
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
                }
            }

            let decWh = "";
            if (intWh !== "") {
                if (shipWh === 0) decWh = 0;
                else if (bunchQty > 0) decWh = (shipWh / bunchQty) - intWh;
            }

            let calculatedFinalWh = "";
            if (!isNaN(shipWh)) {
                if (shipWh <= 0) calculatedFinalWh = "";
                else if (decWh === "") calculatedFinalWh = "";
                else calculatedFinalWh = (intWh * bunchQty) + (decWh > 0 ? bunchQty : 0);
            }
            const displayFinalWh = item.is_manual_final_wh ? item.final_wh : calculatedFinalWh;

            // --- Suggested Final WH logic ---
            const saleWhAvg = Number(item.sale_wh_avg) || 0;
            let suggestedShipWh = 0;
            if (afsDays > 0) {
                suggestedShipWh = Math.ceil(((saleWhAvg / afsDays) * shipmentPlanDays) - availableQty);
            }

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

            let val = 0;
            if (item.stock_alloc && item.stock_alloc.includes(' / ')) {
                val = Number(item.stock_alloc.split(' / ')[1]);
            }
            const quantity = (val > 0) ? val : 0;

            return { ...item, display_quantity: quantity };
        });

        return processedData.filter(item => item.display_quantity > 0);
    }, [calculationData, masterData, useSuggestedWh]);

    // Parse custom attributes to find bag limits
    const getLimits = (item) => {
        let attrs = [];
        if (typeof item.customAttributes === 'string') {
            try { attrs = JSON.parse(item.customAttributes); } catch (e) {}
        } else if (Array.isArray(item.customAttributes)) {
            attrs = item.customAttributes;
        } else if (typeof item.shipment_packaging === 'string') {
            try { attrs = JSON.parse(item.shipment_packaging); } catch (e) {}
        } else if (Array.isArray(item.shipment_packaging)) {
            attrs = item.shipment_packaging;
        }

        let defaultLimit = 50;
        let smallLimit = null;
        let bigLimit = null;

        attrs.forEach(attr => {
            const key = (attr.key || '').toLowerCase();
            const val = Number(attr.value);
            if (!val) return;

            if (key.includes('small')) smallLimit = val;
            else if (key.includes('big') || key.includes('large')) bigLimit = val;
            else if (key.includes('box') || key.includes('bag') || key.includes('limit') || key.includes('capacity')) {
                defaultLimit = val;
            }
        });

        return { 
            smallLimit: smallLimit || defaultLimit, 
            bigLimit: bigLimit || defaultLimit 
        };
    };

    const packingResult = useMemo(() => {
        if (!displayData || displayData.length === 0) return { type: 'single', data: { bags: [], summary: null } };

        const packGroup = (validItems) => {
            if (validItems.length === 0) return { bags: [], summary: null };
            let totalShipmentWeight = 0;
            let totalPieces = 0;
            let bigBagsNeeded = 0;
            let smallBagsNeeded = 0;

            validItems.forEach(item => {
                const qty = item.display_quantity;
                totalPieces += qty;
                const weightPerPiece = item.weightPerPiece;
                totalShipmentWeight += (qty * weightPerPiece);
                const { smallLimit, bigLimit } = getLimits(item);
                bigBagsNeeded += (qty / bigLimit);
                smallBagsNeeded += (qty / smallLimit);
            });

            let bigCount = Math.ceil(bigBagsNeeded);
            let smallCount = Math.ceil(smallBagsNeeded);
            
            let finalBagCount = bigCount;
            let selectedBagType = "Big Bag";

            if (finalBagCount > 0 && (totalShipmentWeight / finalBagCount) > 17) {
                finalBagCount = smallCount;
                selectedBagType = "Small Bag";
                if (finalBagCount > 0 && (totalShipmentWeight / finalBagCount) > 17) {
                    finalBagCount = Math.ceil(totalShipmentWeight / 17);
                    selectedBagType = "Custom Size (Auto-scaled for 17kg)";
                }
            }

            if (finalBagCount === 0) return { bags: [], summary: null };

            let bags = Array.from({ length: finalBagCount }, (_, i) => ({
                id: i + 1,
                type: selectedBagType,
                items: [],
                totalWeight: 0,
                totalQty: 0
            }));

            let leftovers = [];

            validItems.forEach(item => {
                let remainingQty = item.display_quantity;
                const baseQty = Math.floor(remainingQty / finalBagCount);
                const remainder = remainingQty % finalBagCount;
                
                if (baseQty > 0) {
                    bags.forEach((bag) => {
                        bag.items.push({
                            group_name: item.group_name,
                            sku: item.sku,
                            category: item.category,
                            quantity: baseQty
                        });
                        bag.totalQty += baseQty;
                        bag.totalWeight += (baseQty * item.weightPerPiece);
                    });
                }
                if (remainder > 0) {
                    leftovers.push({
                        ...item,
                        quantity: remainder
                    });
                }
            });

            leftovers.forEach(leftover => {
                let remainingToPack = leftover.quantity;
                while(remainingToPack > 0) {
                    bags.sort((a, b) => a.totalWeight - b.totalWeight);
                    const bestBag = bags[0];
                    let existingItem = bestBag.items.find(item => item.sku === leftover.sku);
                    if (existingItem) {
                        existingItem.quantity += 1;
                    } else {
                        bestBag.items.push({
                            group_name: leftover.group_name,
                            sku: leftover.sku,
                            category: leftover.category,
                            quantity: 1
                        });
                    }
                    bestBag.totalQty += 1;
                    bestBag.totalWeight += leftover.weightPerPiece;
                    remainingToPack -= 1;
                }
            });

            bags.sort((a, b) => a.id - b.id);

            return {
                bags,
                summary: {
                    totalBags: finalBagCount,
                    bagType: selectedBagType,
                    totalWeight: totalShipmentWeight,
                    totalPieces: totalPieces,
                    totalSkus: validItems.length
                }
            };
        };

        let validItems = [];
        displayData.forEach(item => {
            if (item.display_quantity > 0) {
                validItems.push({
                    ...item,
                    weightPerPiece: Number(item.weight) || 0
                });
            }
        });

        if (shipmentMode === 'FC') {
            const fcGroups = {};
            validItems.forEach(item => {
                let fcBreakdown = null;
                try {
                    if (item.fc_breakdown) {
                        fcBreakdown = typeof item.fc_breakdown === 'string' ? JSON.parse(item.fc_breakdown) : item.fc_breakdown;
                    }
                } catch(e){}

                if (fcBreakdown) {
                    Object.entries(fcBreakdown).forEach(([fc, data]) => {
                        const finalWh = data.final_wh !== undefined ? data.final_wh : data.calculated_final_wh;
                        if (finalWh > 0) {
                            if (!fcGroups[fc]) fcGroups[fc] = [];
                            fcGroups[fc].push({
                                ...item,
                                display_quantity: finalWh
                            });
                        }
                    });
                } else {
                    if (!fcGroups['Unassigned']) fcGroups['Unassigned'] = [];
                    fcGroups['Unassigned'].push(item);
                }
            });

            const packedFCs = {};
            Object.keys(fcGroups).forEach(fc => {
                packedFCs[fc] = packGroup(fcGroups[fc]);
            });

            return { type: 'multi', data: packedFCs };
        } else {
            return { type: 'single', data: packGroup(validItems) };
        }
    }, [displayData, shipmentMode]);

    const exportToExcel = () => {
        import('xlsx').then((XLSX) => {
            const wb = XLSX.utils.book_new();
            
            const createSheetData = (bags) => {
                const excelData = [];
                bags.forEach(bag => {
                    bag.items.forEach(item => {
                        excelData.push({
                            'Bag ID': `Bag ${bag.id}`,
                            'Bag Type': bag.type,
                            'Bag Total SKUs': bag.items.length,
                            'Bag Total Qty': bag.totalQty,
                            'Bag Total Weight (kg)': bag.totalWeight.toFixed(2),
                            'Group Name': item.group_name || '-',
                            'SKU': item.sku || '-',
                            'Category': item.category || '-',
                            'Quantity': item.quantity
                        });
                    });
                });
                return excelData;
            };

            const colWidths = [
                { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
                { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }
            ];

            if (packingResult.type === 'single') {
                const ws = XLSX.utils.json_to_sheet(createSheetData(packingResult.data.bags));
                ws['!cols'] = colWidths;
                XLSX.utils.book_append_sheet(wb, ws, "Box Planner");
            } else {
                Object.entries(packingResult.data).forEach(([fc, result]) => {
                    const ws = XLSX.utils.json_to_sheet(createSheetData(result.bags));
                    ws['!cols'] = colWidths;
                    const safeSheetName = fc.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
                    XLSX.utils.book_append_sheet(wb, ws, safeSheetName || "Box Planner");
                });
            }

            XLSX.writeFile(wb, "Box_Planner_Export.xlsx");
        });
    };

    const exportToPDF = () => {
        Promise.all([
            import('jspdf'),
            import('jspdf-autotable')
        ]).then(([jsPDFModule, autoTableModule]) => {
            const jsPDF = jsPDFModule.default;
            const doc = new jsPDF();
            const autoTable = autoTableModule.default;
            
            const addBagsToDoc = (bags, summary, title) => {
                doc.setFontSize(18);
                doc.text(title, 14, 22);
                
                doc.setFontSize(11);
                doc.text(`Total Bags: ${summary.totalBags}  |  Total Weight: ${summary.totalWeight.toFixed(2)} kg  |  Total Pieces: ${summary.totalPieces}`, 14, 30);

                let currentY = 40;

                bags.forEach((bag, index) => {
                    if (index > 0) {
                        doc.addPage();
                        currentY = 20;
                    }

                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.text(`Bag ${bag.id} (${bag.type}) - ${bag.items.length} SKUs, ${bag.totalQty} items, ${bag.totalWeight.toFixed(2)} kg`, 14, currentY);
                    
                    const tableData = bag.items.map(item => [
                        item.group_name || '-',
                        item.sku || '-',
                        item.category || '-',
                        item.quantity
                    ]);

                    autoTable(doc, {
                        startY: currentY + 5,
                        head: [['Group Name', 'SKU', 'Category', 'Quantity']],
                        body: tableData,
                        theme: 'grid',
                        headStyles: { fillColor: [90, 93, 246] },
                        styles: { fontSize: 10 },
                        margin: { left: 14 }
                    });

                    currentY = doc.lastAutoTable.finalY + 15;
                });
            };

            if (packingResult.type === 'single') {
                addBagsToDoc(packingResult.data.bags, packingResult.data.summary, "Box Planner Report - IXD");
            } else {
                const fcs = Object.keys(packingResult.data);
                fcs.forEach((fc, idx) => {
                    if (idx > 0) {
                        doc.addPage();
                    }
                    addBagsToDoc(packingResult.data[fc].bags, packingResult.data[fc].summary, `Box Planner Report - ${fc}`);
                });
            }

            doc.save("Box_Planner_Export.pdf");
        });
    };

    const hasBags = useMemo(() => {
        if (packingResult.type === 'single') {
            return packingResult.data.bags && packingResult.data.bags.length > 0;
        } else {
            return Object.keys(packingResult.data).length > 0;
        }
    }, [packingResult]);


    return (
        <div className="space-y-4">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                <div>
                    <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Box Planner</h1>
                    <p className="text-xs text-[#1C2340]/50 mt-0.5">Automated Packing Logic (Max 17kg per bag)</p>
                </div>

                {/* TOGGLE UI REMOVED - NOW HANDLED IN UPLOAD STAGE */}
                {hasBags && (
                    <div className="relative">
                        <button
                            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                            className="flex items-center justify-center bg-[#5A5DF6] text-white p-2 rounded-[6px] hover:bg-[#4A4DD6] transition-colors shadow-sm"
                            title="Download Options"
                        >
                            <Download size={20} />
                        </button>
                        
                        {showDownloadMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#D9DDE5] rounded-[8px] shadow-lg z-10 overflow-hidden">
                                <button
                                    onClick={() => { exportToPDF(); setShowDownloadMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C2340] hover:bg-[#F4F5F7] transition-colors text-left"
                                >
                                    <FileText size={16} className="text-red-500" />
                                    Download as PDF
                                </button>
                                <div className="border-t border-[#D9DDE5]"></div>
                                <button
                                    onClick={() => { exportToExcel(); setShowDownloadMenu(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#1C2340] hover:bg-[#F4F5F7] transition-colors text-left"
                                >
                                    <FileSpreadsheet size={16} className="text-green-600" />
                                    Download as Excel
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm flex flex-col items-center justify-center py-20 gap-2">
                    <Loader2 size={24} className="animate-spin text-[#5A5DF6]" />
                    <p className="text-sm text-[#1C2340]/50">Calculating packing arrangement...</p>
                </div>
            ) : !hasBags ? (
                <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm flex flex-col items-center justify-center py-20 gap-2">
                    <Package size={32} className="text-[#1C2340]/20" />
                    <p className="text-sm text-[#1C2340]/50 font-medium">No stock data found to pack.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {packingResult.type === 'single' ? (
                        <div className="flex flex-col gap-4">
                            {/* Summary Card */}
                            <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm px-5 py-4 flex flex-wrap gap-8 items-center">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Bags</p>
                                    <p className="text-xl font-black text-[#5A5DF6]">{packingResult.data.summary.totalBags}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Bag Size Selected</p>
                                    <p className="text-sm font-bold text-[#1C2340] mt-1">{packingResult.data.summary.bagType}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Shipment Weight</p>
                                    <p className="text-sm font-bold text-[#1C2340] mt-1">{packingResult.data.summary.totalWeight.toFixed(2)} kg</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Pieces</p>
                                    <p className="text-sm font-bold text-[#1C2340] mt-1">{packingResult.data.summary.totalPieces}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total SKUs</p>
                                    <p className="text-sm font-bold text-[#1C2340] mt-1">{packingResult.data.summary.totalSkus}</p>
                                </div>
                            </div>

                            {/* Bags List */}
                            <div className="flex flex-col gap-2">
                                {packingResult.data.bags.map(bag => (
                                    <BagAccordion key={bag.id} bag={bag} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        Object.entries(packingResult.data).map(([fc, result]) => (
                            <div key={fc} className="flex flex-col gap-4 bg-[#F9FAFB] border border-[#D9DDE5] p-4 rounded-[8px]">
                                <h2 className="text-lg font-bold text-[#1C2340] flex items-center gap-2 border-b border-[#D9DDE5] pb-2">
                                    <Truck size={18} className="text-[#5A5DF6]" />
                                    {fc}
                                </h2>
                                
                                {/* Summary Card for FC */}
                                <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm px-5 py-4 flex flex-wrap gap-8 items-center">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Bags</p>
                                        <p className="text-xl font-black text-[#5A5DF6]">{result.summary.totalBags}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Bag Size Selected</p>
                                        <p className="text-sm font-bold text-[#1C2340] mt-1">{result.summary.bagType}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Weight</p>
                                        <p className="text-sm font-bold text-[#1C2340] mt-1">{result.summary.totalWeight.toFixed(2)} kg</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Total Pieces</p>
                                        <p className="text-sm font-bold text-[#1C2340] mt-1">{result.summary.totalPieces}</p>
                                    </div>
                                </div>

                                {/* Bags List for FC */}
                                <div className="flex flex-col gap-2">
                                    {result.bags.map(bag => (
                                        <BagAccordion key={`${fc}-${bag.id}`} bag={bag} />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Boxes;