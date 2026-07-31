const fs = require('fs');
let code = fs.readFileSync('client/src/pages/calculation/Calculation.jsx', 'utf8');

const targetStr = `{/* Sub-rows for Multi-FC Mode */}`;
const startIdx = code.indexOf(targetStr);
const endIdx = code.indexOf('</React.Fragment>', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{/* Sub-rows for Multi-FC Mode */}
                                            {shipmentMode === 'FC' && expandedRows[row.id] && row.fc_breakdown && Object.entries(row.fc_breakdown).map(([fcName, data]) => (
                                                <tr key={fcName} className="hover:bg-blue-50/10 bg-[#F4F5F7]/30 transition-colors border-b border-[#D9DDE5]/30">
                                                    {/* 1. Product Cells */}
                                                    {collapsedGroups.product ? (
                                                        <td className="bg-[#F4F5F7]/40 border-r border-[#D9DDE5]/40"></td>
                                                    ) : (
                                                        <>
                                                            {visibleColumns.group_name && <td style={{ width: colWidthsRef.current.group_name, minWidth: colWidthsRef.current.group_name }} className="px-4 py-3 border-r border-[#D9DDE5]/30"></td>}
                                                            {visibleColumns.sku && <td style={{ width: colWidthsRef.current.sku, minWidth: colWidthsRef.current.sku }} className="px-4 py-3 font-bold text-[#5A5DF6] whitespace-nowrap pl-6">↳ {fcName}</td>}
                                                            {visibleColumns.title && <td style={{ width: colWidthsRef.current.title, minWidth: colWidthsRef.current.title, maxWidth: colWidthsRef.current.title }} className="px-4 py-3"></td>}
                                                            {visibleColumns.category && <td style={{ width: colWidthsRef.current.category, minWidth: colWidthsRef.current.category }} className="px-4 py-3"></td>}
                                                        </>
                                                    )}

                                                    {/* 2. Initial WH Cells */}
                                                    {collapsedGroups.initialWH ? (
                                                        <td className="bg-blue-50/20 border-r border-[#D9DDE5]/40"></td>
                                                    ) : (
                                                        <>
                                                            {visibleColumns.int_wh && <td style={{ width: colWidthsRef.current.int_wh, minWidth: colWidthsRef.current.int_wh }} className="px-4 py-3 border-l border-[#D9DDE5]/30"></td>}
                                                            {visibleColumns.dec_wh && <td style={{ width: colWidthsRef.current.dec_wh, minWidth: colWidthsRef.current.dec_wh }} className="px-4 py-3"></td>}
                                                            {visibleColumns.non_apron_qty && <td style={{ width: colWidthsRef.current.non_apron_qty, minWidth: colWidthsRef.current.non_apron_qty }} className="px-4 py-3"></td>}
                                                        </>
                                                    )}

                                                    {/* 3. Variants Cells */}
                                                    {collapsedGroups.variants ? (
                                                        <td className="bg-purple-50/20 border-r border-[#D9DDE5]/40"></td>
                                                    ) : (
                                                        <>
                                                            {visibleColumns.sky_blue && activeVariantCols.sky_blue && <td style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 border-l border-[#D9DDE5]/30"></td>}
                                                            {visibleColumns.dark_blue && activeVariantCols.dark_blue && <td style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3"></td>}
                                                            {visibleColumns.brown && activeVariantCols.brown && <td style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3"></td>}
                                                            {visibleColumns.green && activeVariantCols.green && <td style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3"></td>}
                                                            {visibleColumns.tan && activeVariantCols.tan && <td style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3"></td>}
                                                            {visibleColumns.black && activeVariantCols.black && <td style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3"></td>}
                                                            {visibleColumns.red && activeVariantCols.red && <td style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3"></td>}
                                                            {visibleColumns.grey && activeVariantCols.grey && <td style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3"></td>}
                                                        </>
                                                    )}

                                                    {/* 4. Specs & Financials Cells */}
                                                    {collapsedGroups.specs ? (
                                                        <td className="bg-green-50/20 border-r border-[#D9DDE5]/40"></td>
                                                    ) : (
                                                        <>
                                                            {visibleColumns.weight && <td style={{ width: colWidthsRef.current.weight, minWidth: colWidthsRef.current.weight }} className="px-4 py-3 border-l border-[#D9DDE5]/30"></td>}
                                                            {visibleColumns.total_weight && <td style={{ width: colWidthsRef.current.total_weight, minWidth: colWidthsRef.current.total_weight }} className="px-4 py-3"></td>}
                                                            {visibleColumns.hsn && <td style={{ width: colWidthsRef.current.hsn, minWidth: colWidthsRef.current.hsn }} className="px-4 py-3"></td>}
                                                            {visibleColumns.gst && <td style={{ width: colWidthsRef.current.gst, minWidth: colWidthsRef.current.gst }} className="px-4 py-3"></td>}
                                                            {visibleColumns.cost && <td style={{ width: colWidthsRef.current.cost, minWidth: colWidthsRef.current.cost }} className="px-4 py-3"></td>}
                                                        </>
                                                    )}

                                                    {/* 5. Logistics Cells */}
                                                    {collapsedGroups.logistics ? (
                                                        <td className="bg-orange-50/20"></td>
                                                    ) : (
                                                        <>
                                                            {visibleColumns.ref_sku && <td style={{ width: colWidthsRef.current.ref_sku, minWidth: colWidthsRef.current.ref_sku }} className="px-4 py-3 border-l border-[#D9DDE5]/30"></td>}
                                                            {visibleColumns.ref_title && <td style={{ width: colWidthsRef.current.ref_title, minWidth: colWidthsRef.current.ref_title, maxWidth: colWidthsRef.current.ref_title }} className="px-4 py-3"></td>}
                                                            {visibleColumns.tra_qty && <td style={{ width: colWidthsRef.current.tra_qty, minWidth: colWidthsRef.current.tra_qty }} className="px-4 py-3"></td>}
                                                            {visibleColumns.quantity && <td style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3"></td>}
                                                            {visibleColumns.available_qty && <td style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3"></td>}
                                                            {visibleColumns.sale_wh && <td style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center bg-blue-50/30 font-medium text-[#1C2340]">{data.sale_wh}</td>}
                                                            {visibleColumns.sale_wh_avg && <td style={{ width: colWidthsRef.current.sale_wh_avg, minWidth: colWidthsRef.current.sale_wh_avg }} className="px-4 py-3 text-center bg-blue-50/30 text-[#1C2340]/60">{data.sale_wh_avg}</td>}
                                                            {visibleColumns.ship_wh && <td style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center font-bold bg-[#E8F0FE]">{/* Ship WH for FC not calculated */}</td>}
                                                            {visibleColumns.sum_val && <td style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center font-bold bg-[#F4F5F7]"></td>}
                                                            {visibleColumns.stock_alloc && <td style={{ width: colWidthsRef.current.stock_alloc, minWidth: colWidthsRef.current.stock_alloc }} className="px-4 py-3 text-center font-bold text-[#E74C3C] bg-red-50/30"></td>}
                                                            {visibleColumns.final_wh && (
                                                                <td style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className="px-4 py-3 text-center bg-[#E8F0FE]">
                                                                    <input 
                                                                        type="number"
                                                                        value={data.final_wh === "" ? "" : data.final_wh}
                                                                        onChange={(e) => handleFcFinalWhSubmit(row.id, fcName, e.target.value)}
                                                                        className="w-16 text-center border-b border-blue-400 bg-transparent outline-none focus:border-blue-600 font-bold text-[#1C2340]"
                                                                    />
                                                                </td>
                                                            )}
                                                            {visibleColumns.suggest_final_wh && <td style={{ width: colWidthsRef.current.suggest_final_wh, minWidth: colWidthsRef.current.suggest_final_wh }} className="px-4 py-3 text-center bg-green-50/30 text-[#22B573] font-bold">{data.suggest_final_wh}</td>}
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                            `;
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    fs.writeFileSync('client/src/pages/calculation/Calculation.jsx', code);
    console.log('Replaced sub-row logic successfully.');
} else {
    console.log('Could not find target strings for replacement.');
}
