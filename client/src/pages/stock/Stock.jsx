import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import api from '../../services/api';

const Stock = () => {
    const [calculationData, setCalculationData] = useState([]);
    const [masterData, setMasterData] = useState({
        afs_days: 0, shipment_plan_days: 0, bunch_qty: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    // --- FETCH DATA FROM DATABASE (Calculation.jsx jaisa hi) ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await api.get("/getCalculationData", { params: { _t: Date.now() } });
                if (response.data && response.data.data) {
                    if (response.data.data.master) setMasterData(response.data.data.master);
                    if (response.data.data.items) setCalculationData(response.data.data.items);
                }
            } catch (error) {
                console.error("Error fetching stock data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // Sabse pehle Final-WH ko wahi formula se calculate karo jo Calculation.jsx me hai
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

        displayData.forEach((item) => {
            const finalWh = Number(item.final_wh) || 0;
            if (finalWh <= 0) return; // Blank/0 wale SKUs ko skip karo

            // SKU name se "PACK OF X" nikal ke multiplier decide karo (agar nahi mila to multiplier 1 rahega)
            const packMatch = item.sku && item.sku.toUpperCase().match(/PACK OF\s*(\d+)/);
            const multiplier = packMatch ? Number(packMatch[1]) : 1;

            const effectiveQty = finalWh * multiplier;
            const groupName = item.group_name || 'Unknown';

            if (!groups[groupName]) {
                groups[groupName] = 0;
            }
            groups[groupName] += effectiveQty;
        });

        // Object ko array me convert karo, taaki .map() se render kar sakein
        return Object.entries(groups).map(([groupName, totalFinalWh]) => ({
            group_name: groupName,
            final_wh: totalFinalWh
        }));
    }, [displayData]);

    return (
        <div className="space-y-3">
            <div>
                <h1 className="text-lg font-bold text-[#1C2340] leading-tight">Stock Summary</h1>
                <p className="text-xs text-[#1C2340]/50 mt-0.5">Group-wise total Final-WH (Pack SKUs multiplied accordingly)</p>
            </div>

            <div className="bg-white border border-[#D9DDE5] rounded-[5px] shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Loader2 size={24} className="animate-spin text-[#5A5DF6]" />
                        <p className="text-sm text-[#1C2340]/50">Loading stock data...</p>
                    </div>
                ) : groupedStock.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Layers size={32} className="text-[#1C2340]/20" />
                        <p className="text-sm text-[#1C2340]/50 font-medium">No stock data found.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-xs">
                        <thead className="bg-[#F4F5F7] border-b border-[#D9DDE5]">
                            <tr>
                                <th className="px-4 py-3 font-bold text-[#1C2340]/70 uppercase tracking-wider">Group Name</th>
                                <th className="px-4 py-3 text-center font-bold text-[#1C2340]/70 uppercase tracking-wider">Final - WH</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D9DDE5]">
                            {groupedStock.map((row, idx) => (
                                <tr key={idx} className="hover:bg-[#F4F5F7]/60 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-[#1C2340]">{row.group_name}</td>
                                    <td className="px-4 py-3 text-center font-bold text-[#5A5DF6]">{row.final_wh}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Stock;