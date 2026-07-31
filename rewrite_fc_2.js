const fs = require('fs');
let code = fs.readFileSync('client/src/pages/calculation/Calculation.jsx', 'utf8');

const targetStr = `{/* Sub-rows for Multi-FC Mode */}`;
const startIdx = code.indexOf(targetStr);
const endIdx = code.indexOf('</React.Fragment>', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{/* Sub-rows for Multi-FC Mode */}
                                            {shipmentMode === 'FC' && expandedRows[row.id] && row.fc_breakdown && (
                                                <tr className="bg-[#F4F5F7]/30 border-b border-[#D9DDE5]/50">
                                                    <td colSpan={100} className="p-0">
                                                        <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
                                                            <colgroup>
                                                                {/* Duplicate the exact colgroup from parent to maintain perfect alignment */}
                                                                {!collapsedGroups.product && (
                                                                    <>
                                                                        {visibleColumns.group_name && <col style={{ width: colWidthsRef.current.group_name }} />}
                                                                        {visibleColumns.sku && <col style={{ width: colWidthsRef.current.sku }} />}
                                                                        {visibleColumns.title && <col style={{ width: colWidthsRef.current.title }} />}
                                                                        {visibleColumns.category && <col style={{ width: colWidthsRef.current.category }} />}
                                                                    </>
                                                                )}
                                                                {!collapsedGroups.initialWH && (
                                                                    <>
                                                                        {visibleColumns.int_wh && <col style={{ width: colWidthsRef.current.int_wh }} />}
                                                                        {visibleColumns.dec_wh && <col style={{ width: colWidthsRef.current.dec_wh }} />}
                                                                        {visibleColumns.non_apron_qty && <col style={{ width: colWidthsRef.current.non_apron_qty }} />}
                                                                    </>
                                                                )}
                                                                {!collapsedGroups.variants && (
                                                                    <>
                                                                        {visibleColumns.sky_blue && activeVariantCols.sky_blue && <col style={{ width: colWidthsRef.current.sky_blue }} />}
                                                                        {visibleColumns.dark_blue && activeVariantCols.dark_blue && <col style={{ width: colWidthsRef.current.dark_blue }} />}
                                                                        {visibleColumns.brown && activeVariantCols.brown && <col style={{ width: colWidthsRef.current.brown }} />}
                                                                        {visibleColumns.green && activeVariantCols.green && <col style={{ width: colWidthsRef.current.green }} />}
                                                                        {visibleColumns.tan && activeVariantCols.tan && <col style={{ width: colWidthsRef.current.tan }} />}
                                                                        {visibleColumns.black && activeVariantCols.black && <col style={{ width: colWidthsRef.current.black }} />}
                                                                        {visibleColumns.red && activeVariantCols.red && <col style={{ width: colWidthsRef.current.red }} />}
                                                                        {visibleColumns.grey && activeVariantCols.grey && <col style={{ width: colWidthsRef.current.grey }} />}
                                                                    </>
                                                                )}
                                                                {!collapsedGroups.specs && (
                                                                    <>
                                                                        {visibleColumns.weight && <col style={{ width: colWidthsRef.current.weight }} />}
                                                                        {visibleColumns.total_weight && <col style={{ width: colWidthsRef.current.total_weight }} />}
                                                                        {visibleColumns.hsn && <col style={{ width: colWidthsRef.current.hsn }} />}
                                                                        {visibleColumns.gst && <col style={{ width: colWidthsRef.current.gst }} />}
                                                                        {visibleColumns.cost && <col style={{ width: colWidthsRef.current.cost }} />}
                                                                    </>
                                                                )}
                                                                {!collapsedGroups.logistics && (
                                                                    <>
                                                                        {visibleColumns.ref_sku && <col style={{ width: colWidthsRef.current.ref_sku }} />}
                                                                        {visibleColumns.ref_title && <col style={{ width: colWidthsRef.current.ref_title }} />}
                                                                        {visibleColumns.tra_qty && <col style={{ width: colWidthsRef.current.tra_qty }} />}
                                                                        {visibleColumns.quantity && <col style={{ width: colWidthsRef.current.quantity }} />}
                                                                        {visibleColumns.available_qty && <col style={{ width: colWidthsRef.current.available_qty }} />}
                                                                        {visibleColumns.sale_wh && <col style={{ width: colWidthsRef.current.sale_wh }} />}
                                                                        {visibleColumns.sale_wh_avg && <col style={{ width: colWidthsRef.current.sale_wh_avg }} />}
                                                                        {visibleColumns.ship_wh && <col style={{ width: colWidthsRef.current.ship_wh }} />}
                                                                        {visibleColumns.sum_val && <col style={{ width: colWidthsRef.current.sum_val }} />}
                                                                        {visibleColumns.stock_alloc && <col style={{ width: colWidthsRef.current.stock_alloc }} />}
                                                                        {visibleColumns.final_wh && <col style={{ width: colWidthsRef.current.final_wh }} />}
                                                                        {visibleColumns.suggest_final_wh && <col style={{ width: colWidthsRef.current.suggest_final_wh }} />}
                                                                    </>
                                                                )}
                                                            </colgroup>
                                                            <tbody>
                                                                {Object.entries(row.fc_breakdown).map(([fcName, data]) => (
                                                                    <tr key={fcName} className="hover:bg-blue-50/20 transition-colors">
                                                                        {!collapsedGroups.product && (
                                                                            <>
                                                                                {visibleColumns.group_name && <td className="px-4 py-2 border-r border-[#D9DDE5]/30"></td>}
                                                                                {visibleColumns.sku && <td className="px-4 py-2 font-bold text-[#5A5DF6] whitespace-nowrap pl-6">↳ {fcName}</td>}
                                                                                {visibleColumns.title && <td className="px-4 py-2 text-[10px] text-blue-600 font-medium">Sale Ratio: {(data.ratio * 100).toFixed(1)}%</td>}
                                                                                {visibleColumns.category && <td className="px-4 py-2"></td>}
                                                                            </>
                                                                        )}

                                                                        {!collapsedGroups.initialWH && (
                                                                            <>
                                                                                {visibleColumns.int_wh && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                {visibleColumns.dec_wh && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.non_apron_qty && <td className="px-4 py-2"></td>}
                                                                            </>
                                                                        )}

                                                                        {!collapsedGroups.variants && (
                                                                            <>
                                                                                {visibleColumns.sky_blue && activeVariantCols.sky_blue && <td className="px-3 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                {visibleColumns.dark_blue && activeVariantCols.dark_blue && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.brown && activeVariantCols.brown && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.green && activeVariantCols.green && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.tan && activeVariantCols.tan && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.black && activeVariantCols.black && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.red && activeVariantCols.red && <td className="px-3 py-2"></td>}
                                                                                {visibleColumns.grey && activeVariantCols.grey && <td className="px-3 py-2"></td>}
                                                                            </>
                                                                        )}

                                                                        {!collapsedGroups.specs && (
                                                                            <>
                                                                                {visibleColumns.weight && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                {visibleColumns.total_weight && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.hsn && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.gst && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.cost && <td className="px-4 py-2"></td>}
                                                                            </>
                                                                        )}

                                                                        {!collapsedGroups.logistics && (
                                                                            <>
                                                                                {visibleColumns.ref_sku && <td className="px-4 py-2 border-l border-[#D9DDE5]/30"></td>}
                                                                                {visibleColumns.ref_title && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.tra_qty && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.quantity && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.available_qty && <td className="px-4 py-2"></td>}
                                                                                {visibleColumns.sale_wh && <td className="px-4 py-2 text-center bg-blue-50/30 font-medium text-[#1C2340]">{data.sale_wh}</td>}
                                                                                {visibleColumns.sale_wh_avg && <td className="px-4 py-2 text-center bg-blue-50/30 text-[#1C2340]/60">{data.sale_wh_avg}</td>}
                                                                                {visibleColumns.ship_wh && <td className="px-4 py-2 text-center font-bold bg-[#E8F0FE]">{/* Ship WH for FC not calculated */}</td>}
                                                                                {visibleColumns.sum_val && <td className="px-4 py-2 text-center font-bold bg-[#F4F5F7]"></td>}
                                                                                {visibleColumns.stock_alloc && <td className="px-4 py-2 text-center font-bold text-[#E74C3C] bg-red-50/30"></td>}
                                                                                {visibleColumns.final_wh && (
                                                                                    <td className="px-4 py-2 text-center bg-[#E8F0FE]">
                                                                                        <input 
                                                                                            type="number"
                                                                                            value={data.final_wh === "" ? "" : data.final_wh}
                                                                                            onChange={(e) => handleFcFinalWhSubmit(row.id, fcName, e.target.value)}
                                                                                            className="w-16 text-center border-b border-blue-400 bg-transparent outline-none focus:border-blue-600 font-bold text-[#1C2340]"
                                                                                        />
                                                                                    </td>
                                                                                )}
                                                                                {visibleColumns.suggest_final_wh && <td className="px-4 py-2 text-center bg-green-50/30 text-[#22B573] font-bold">{data.suggest_final_wh}</td>}
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                            `;
    code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
    fs.writeFileSync('client/src/pages/calculation/Calculation.jsx', code);
    console.log('Replaced sub-row logic successfully.');
} else {
    console.log('Could not find target strings for replacement.');
}
