import React, { useState, useEffect, useMemo } from 'react';
import { Package, Loader2, Boxes as BoxesIcon } from 'lucide-react';
import api from '../../services/api';

const Boxes = () => {
    const [calculationData, setCalculationData] = useState([]);
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    // 🔥 NAYE STATES: Small aur Big Bag Limits (LocalStorage ke sath)
    const [bagLimits, setBagLimits] = useState(() => {
        try {
            const saved = localStorage.getItem('boxes_bagLimits');
            return saved ? JSON.parse(saved) : { small: 50, big: 100 }; // Default values
        } catch {
            return { small: 50, big: 100 };
        }
    });

    // Jab bhi bagLimits change ho, localStorage me save kar do
    useEffect(() => {
        localStorage.setItem('boxes_bagLimits', JSON.stringify(bagLimits));
    }, [bagLimits]);

    const handleLimitChange = (e) => {
        const { name, value } = e.target;
        // Khaali hone par empty string rehne do, warna number me convert karo
        setBagLimits(prev => ({
            ...prev,
            [name]: value === "" ? "" : Number(value)
        }));
    };


    // --- FETCH REQUIRED STOCK DATA (Calculation.jsx jaisa hi) ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get("/getCalculationData", { params: { _t: Date.now() } });
                if (response.data && response.data.data) {
                    if (response.data.data.master) setMasterData(response.data.data.master);
                    if (response.data.data.items) setCalculationData(response.data.data.items);
                }
            } catch (error) {
                console.error("Error fetching boxes data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

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

    // Category ke basis pe grouping — jitna total stock bhejna hai (SKU "PACK OF X" ke sath multiply karke)
    const categoryTotals = useMemo(() => {
        const cats = {};

        displayData.forEach((item) => {
            const finalWh = Number(item.final_wh) || 0;
            if (finalWh <= 0) return;

            const packMatch = item.sku && item.sku.toUpperCase().match(/PACK OF\s*(\d+)/);
            const multiplier = packMatch ? Number(packMatch[1]) : 1;
            const effectiveQty = finalWh * multiplier;

            const category = item.category || 'Unknown';
            if (!cats[category]) cats[category] = 0;
            cats[category] += effectiveQty;
        });

        return Object.entries(cats)
            .map(([category, totalQty]) => ({ category, totalQty }))
            .sort((a, b) => b.totalQty - a.totalQty);
    }, [displayData]);

    // Table ke footer ke liye Total Quantity calculate kar rahe hain
    const totalQty = categoryTotals.reduce((sum, row) => sum + row.totalQty, 0);

    // 🔥 DYNAMIC CALCULATIONS: Exact totals for Small and Big bags
    const totalSmallExact = useMemo(() => {
        if (!bagLimits.small || bagLimits.small <= 0) return 0;
        return categoryTotals.reduce((sum, row) => sum + (row.totalQty / bagLimits.small), 0);
    }, [categoryTotals, bagLimits.small]);

    const totalBigExact = useMemo(() => {
        if (!bagLimits.big || bagLimits.big <= 0) return 0;
        return categoryTotals.reduce((sum, row) => sum + (row.totalQty / bagLimits.big), 0);
    }, [categoryTotals, bagLimits.big]);

    const totalSmallRounded = Math.ceil(totalSmallExact);
    const totalBigRounded = Math.ceil(totalBigExact);
    console.log("totalSmallRounded", totalSmallRounded)
    console.log("totalBigRounded", totalBigRounded)

    // 🔥 DYNAMIC WEIGHT CALCULATION (Excel logic: (Sum of Total Weights / 1000) / Total Bags)
    // Pehle pure categoryTotals se total weight nikalenge
    const totalWeightKg = useMemo(() => {
        return displayData.reduce((sum, item) => sum + (Number(item.total_weight) || 0), 0) / 1000;
    }, [displayData]);
    console.log("totalWeightKg", totalWeightKg)
    // console.log("",)

    // Ab Excel formula ke hisab se weight per bag calculate karenge
    const weightSmall = totalSmallRounded > 0 ? (totalWeightKg / totalSmallRounded).toFixed(3) : 0;
    const weightBig = totalBigRounded > 0 ? (totalWeightKg / totalBigRounded).toFixed(3) : 0;


    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Box Planner</h1>
                <p className="text-xs text-[#1C2340]/50 mt-0.5">Category-wise total Required Stock</p>
            </div>

            <div className="flex items-start justify-start pb-4">
                {/* Table aur Input box ko ek column me wrap kiya taaki width same rahe */}
                <div className="flex flex-col gap-3 w-auto inline-block">

                    {/* DYNAMIC BAG LIMIT INPUTS (Theek BLR4 ke upar) */}
                    <div className="flex items-center justify-between bg-white border border-[#D9DDE5] px-5 py-2 mb-4 rounded-[8px] shadow-sm w-full">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">Small Bag:</span>
                            <input
                                type="number"
                                name="small"
                                value={bagLimits?.small || ''}
                                onChange={handleLimitChange}
                                className="w-14 text-center text-sm font-black text-[#5A5DF6] border-b-2 border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none bg-transparent transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#1C2340]/60 uppercase tracking-wider">Big Bag:</span>
                            <input
                                type="number"
                                name="big"
                                value={bagLimits?.big || ''}
                                onChange={handleLimitChange}
                                className="w-14 text-center text-sm font-black text-[#5A5DF6] border-b-2 border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none bg-transparent transition-colors"
                            />
                        </div>
                    </div>

                    {/* Table Container */}
                    <div className="bg-white border border-[#D9DDE5] rounded-[8px] shadow-sm overflow-hidden w-full">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 px-32 gap-2">
                                <Loader2 size={24} className="animate-spin text-[#5A5DF6]" />
                                <p className="text-sm text-[#1C2340]/50">Loading data...</p>
                            </div>
                        ) : categoryTotals.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 px-32 gap-2">
                                <Package size={32} className="text-[#1C2340]/20" />
                                <p className="text-sm text-[#1C2340]/50 font-medium">No stock data found.</p>
                            </div>
                        ) : (
                            <table className="w-auto min-w-[500px] text-left text-xs whitespace-nowrap">
                                <thead className="bg-[#F4F5F7]">
                                    <tr className="border-b border-[#D9DDE5]">
                                        <th colSpan={4} className="px-5 py-2.5 text-center font-black text-[#1C2340] text-sm tracking-widest uppercase bg-[#5A5DF6]/10">
                                            BLR4
                                        </th>
                                    </tr>
                                    <tr className="border-b border-[#D9DDE5]">
                                        <th className="px-5 py-2.5 font-semibold text-[#1C2340]/50"></th>
                                        <th className="px-5 py-2.5 text-center font-bold text-[#1C2340]">Qty</th>
                                        <th className="px-5 py-2.5 text-center font-bold text-[#1C2340]">Small</th>
                                        <th className="px-5 py-2.5 text-center font-bold text-[#1C2340]">Big</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#D9DDE5]/40">
                                    {categoryTotals.map((row, idx) => {
                                        // ROW WISE CALCULATION
                                        const smallBags = (bagLimits.small && bagLimits.small > 0) ? (row.totalQty / bagLimits.small) : 0;
                                        const bigBags = (bagLimits.big && bagLimits.big > 0) ? (row.totalQty / bagLimits.big) : 0;

                                        return (
                                            <tr key={idx} className="hover:bg-[#F4F5F7]/60 transition-colors">
                                                <td className="px-5 py-2 font-medium text-[#1C2340]">{row.category}</td>
                                                <td className="px-5 py-2 text-center font-semibold text-[#5A5DF6]">{row.totalQty}</td>
                                                <td className="px-5 py-2 text-center text-[#1C2340]/80">
                                                    {smallBags === 0 ? "0" : Number.isInteger(smallBags) ? smallBags : smallBags.toFixed(10).replace(/\.?0+$/, '')}
                                                </td>
                                                <td className="px-5 py-2 text-center text-[#1C2340]/80">
                                                    {bigBags === 0 ? "0" : Number.isInteger(bigBags) ? bigBags : bigBags.toFixed(10).replace(/\.?0+$/, '')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-[#F9FAFB] border-t-2 border-[#D9DDE5]">
                                    <tr className="border-b border-[#D9DDE5]/40">
                                        <td className="px-5 py-2 font-bold text-[#1C2340] text-right"></td>
                                        <td className="px-5 py-2 text-center font-black text-[#1C2340] text-sm">{totalQty}</td>
                                        {/* Exact Totals */}
                                        <td className="px-5 py-2 text-center font-semibold text-[#1C2340]/80">
                                            {totalSmallExact === 0 ? "0" : Number.isInteger(totalSmallExact) ? totalSmallExact : totalSmallExact.toFixed(8)}
                                        </td>
                                        <td className="px-5 py-2 text-center font-semibold text-[#1C2340]/80">
                                            {totalBigExact === 0 ? "0" : Number.isInteger(totalBigExact) ? totalBigExact : totalBigExact.toFixed(8)}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-[#D9DDE5]/40">
                                        <td colSpan={2} className="px-5 py-2"></td>
                                        {/* Rounded Totals */}
                                        <td className="px-5 py-2 text-center font-bold text-[#1C2340]">{totalSmallRounded}</td>
                                        <td className="px-5 py-2 text-center font-bold text-[#1C2340]">{totalBigRounded}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-5 py-3 font-bold text-[#1C2340]">Weight per bag</td>
                                        <td className="px-5 py-3"></td>
                                        {/* Weight (Total Qty / Rounded Bags) */}
                                        <td className="px-5 py-3 text-center font-bold text-[#5A5DF6]">{weightSmall}</td>
                                        <td className="px-5 py-3 text-center font-bold text-[#5A5DF6]">{weightBig}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Boxes;