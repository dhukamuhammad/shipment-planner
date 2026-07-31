{/* 🔥 COMPLETE EXCEL-STYLE TABLE WITH FILTER & ACTIONS 🔥 */ }
<div className="w-full overflow-x-auto overflow-y-auto custom-scrollbar min-h-[300px] max-h-[72vh] bg-white">
    {filteredData.length === 0 ? (
        <div className="flex justify-center items-center h-full min-h-[300px]">
            <p className="text-sm text-[#1C2340]/50 font-medium py-10">No data found in database. Please upload a report.</p>
        </div>
    ) : (
        <table ref={typeof tableRef !== 'undefined' ? tableRef : null} className="text-left whitespace-nowrap" style={typeof calculateTotalTableWidth === 'function' ? { width: calculateTotalTableWidth() } : { minWidth: "2500px" }}>

            {/* 🔥 COLGROUP */}
            <colgroup>
                {collapsedGroups.product ? <col style={{ width: 40 }} /> : <>
                    {visibleColumns.group_name && <col style={{ width: colWidthsRef.current.group_name }} />}
                    {visibleColumns.sku && <col style={{ width: colWidthsRef.current.sku }} />}
                    {visibleColumns.title && <col style={{ width: colWidthsRef.current.title }} />}
                    {visibleColumns.category && <col style={{ width: colWidthsRef.current.category }} />}
                </>}

                {collapsedGroups.initialWH ? <col style={{ width: 40 }} /> : <>
                    {visibleColumns.int_wh && <col style={{ width: colWidthsRef.current.int_wh }} />}
                    {visibleColumns.dec_wh && <col style={{ width: colWidthsRef.current.dec_wh }} />}
                    {visibleColumns.non_apron_qty && <col style={{ width: colWidthsRef.current.non_apron_qty }} />}
                </>}

                {collapsedGroups.variants ? <col style={{ width: 40 }} /> : <>
                    {visibleColumns.sky_blue && <col style={{ width: colWidthsRef.current.sky_blue }} />}
                    {visibleColumns.dark_blue && <col style={{ width: colWidthsRef.current.dark_blue }} />}
                    {visibleColumns.brown && <col style={{ width: colWidthsRef.current.brown }} />}
                    {visibleColumns.green && <col style={{ width: colWidthsRef.current.green }} />}
                    {visibleColumns.tan && <col style={{ width: colWidthsRef.current.tan }} />}
                    {visibleColumns.black && <col style={{ width: colWidthsRef.current.black }} />}
                    {visibleColumns.red && <col style={{ width: colWidthsRef.current.red }} />}
                    {visibleColumns.grey && <col style={{ width: colWidthsRef.current.grey }} />}
                </>}

                {collapsedGroups.specs ? <col style={{ width: 40 }} /> : <>
                    {visibleColumns.weight && <col style={{ width: colWidthsRef.current.weight }} />}
                    {visibleColumns.total_weight && <col style={{ width: colWidthsRef.current.total_weight }} />}
                    {visibleColumns.hsn && <col style={{ width: colWidthsRef.current.hsn }} />}
                    {visibleColumns.gst && <col style={{ width: colWidthsRef.current.gst }} />}
                    {visibleColumns.cost && <col style={{ width: colWidthsRef.current.cost }} />}
                </>}

                {collapsedGroups.logistics ? <col style={{ width: 40 }} /> : <>
                    {visibleColumns.ref_sku && <col style={{ width: colWidthsRef.current.ref_sku }} />}
                    {visibleColumns.ref_title && <col style={{ width: colWidthsRef.current.ref_title }} />}
                    {visibleColumns.tra_qty && <col style={{ width: colWidthsRef.current.tra_qty }} />}
                    {visibleColumns.quantity && <col style={{ width: colWidthsRef.current.quantity }} />}
                    {visibleColumns.available_qty && <col style={{ width: colWidthsRef.current.available_qty }} />}
                    {visibleColumns.fc_id && <col style={{ width: colWidthsRef.current.fc_id }} />}
                    {visibleColumns.sale_total && <col style={{ width: colWidthsRef.current.sale_total }} />}
                    {visibleColumns.sale_wh && <col style={{ width: colWidthsRef.current.sale_wh }} />}
                    {visibleColumns.ship_wh && <col style={{ width: colWidthsRef.current.ship_wh }} />}
                    {visibleColumns.sum_val && <col style={{ width: colWidthsRef.current.sum_val }} />}
                    {visibleColumns.final_wh && <col style={{ width: colWidthsRef.current.final_wh }} />}
                </>}
                {/* Action Column ColGroup */}
                <col style={{ width: 80 }} />
            </colgroup>

            {/* SMART THEAD */}
            <thead className="sticky top-0 z-20 shadow-sm bg-white">
                {/* Top Row - Grouped Headers */}
                <tr className={`${typeof activeHead !== 'undefined' ? activeHead : 'text-[10px]'} font-bold text-[#1C2340]/60 uppercase tracking-wider border-b border-[#D9DDE5]`}>

                    {/* 1. Product Identification */}
                    {collapsedGroups.product ? (
                        <th rowSpan={2} className="w-6 py-2 bg-[#F4F5F7] border-r border-b-2 border-[#D9DDE5] align-top">
                            <div className="flex flex-col items-center gap-1.5">
                                <button onClick={() => toggleGroup('product')} className="p-0.5 hover:bg-black/10 rounded transition-colors"><ChevronRight size={12} title="Expand" /></button>
                                <span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>PRODUCT</span>
                            </div>
                        </th>
                    ) : productSpan > 0 && (
                        <th className="px-4 py-3 bg-[#F4F5F7]" colSpan={productSpan}>
                            <div className="flex items-center justify-between">
                                <span>Product Identification</span>
                                <button onClick={() => toggleGroup('product')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button>
                            </div>
                        </th>
                    )}

                    {/* 2. Initial WH */}
                    {collapsedGroups.initialWH ? (
                        <th rowSpan={2} className="w-6 py-2 bg-blue-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                            <div className="flex flex-col items-center gap-1.5">
                                <button onClick={() => toggleGroup('initialWH')} className="p-0.5 hover:bg-black/10 rounded transition-colors"><ChevronRight size={12} /></button>
                                <span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>INITIAL WH</span>
                            </div>
                        </th>
                    ) : initWHSpan > 0 && (
                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-blue-50" colSpan={initWHSpan}>
                            <div className="flex items-center justify-between">
                                <span>Initial WH Quantities</span>
                                <button onClick={() => toggleGroup('initialWH')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button>
                            </div>
                        </th>
                    )}

                    {/* 3. Variants */}
                    {collapsedGroups.variants ? (
                        <th rowSpan={2} className="w-6 py-2 bg-purple-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                            <div className="flex flex-col items-center gap-1.5">
                                <button onClick={() => toggleGroup('variants')} className="p-0.5 hover:bg-black/10 rounded transition-colors"><ChevronRight size={12} /></button>
                                <span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>VARIANTS</span>
                            </div>
                        </th>
                    ) : variantsSpan > 0 && (
                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-purple-50" colSpan={variantsSpan}>
                            <div className="flex items-center justify-between">
                                <span>Variant Breakdown</span>
                                <button onClick={() => toggleGroup('variants')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button>
                            </div>
                        </th>
                    )}

                    {/* 4. Specs */}
                    {collapsedGroups.specs ? (
                        <th rowSpan={2} className="w-6 py-2 bg-green-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                            <div className="flex flex-col items-center gap-1.5">
                                <button onClick={() => toggleGroup('specs')} className="p-0.5 hover:bg-black/10 rounded transition-colors"><ChevronRight size={12} /></button>
                                <span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>SPECS</span>
                            </div>
                        </th>
                    ) : specsSpan > 0 && (
                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-green-50" colSpan={specsSpan}>
                            <div className="flex items-center justify-between">
                                <span>Specs & Financials</span>
                                <button onClick={() => toggleGroup('specs')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button>
                            </div>
                        </th>
                    )}

                    {/* 5. Logistics */}
                    {collapsedGroups.logistics ? (
                        <th rowSpan={2} className="w-6 py-2 bg-orange-50 border-l border-r border-b-2 border-[#D9DDE5]/50 align-top">
                            <div className="flex flex-col items-center gap-1.5">
                                <button onClick={() => toggleGroup('logistics')} className="p-0.5 hover:bg-black/10 rounded transition-colors"><ChevronRight size={12} /></button>
                                <span className="text-[9px] tracking-[0.1em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>LOGISTICS</span>
                            </div>
                        </th>
                    ) : logisticsSpan > 0 && (
                        <th className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-orange-50" colSpan={logisticsSpan}>
                            <div className="flex items-center justify-between">
                                <span>Logistics & Calculation</span>
                                <button onClick={() => toggleGroup('logistics')} className="p-0.5 hover:bg-black/10 rounded"><ChevronLeft size={14} /></button>
                            </div>
                        </th>
                    )}

                    {/* ACTION COLUMN HEADER */}
                    <th rowSpan={2} className="w-20 px-2 py-3 bg-[#F4F5F7] border-l border-b-2 border-[#D9DDE5] align-bottom text-center">
                        Action
                    </th>
                </tr>

                {/* Bottom Row - Specific Headers */}
                <tr className={`${typeof activeSubHead !== 'undefined' ? activeSubHead : 'text-[11px]'} font-semibold text-[#1C2340] border-b-2 border-[#D9DDE5] bg-white relative z-10`}>
                    {!collapsedGroups.product && (
                        <>
                            {visibleColumns.group_name && <th style={{ width: colWidthsRef.current.group_name, minWidth: colWidthsRef.current.group_name }} className="px-4 py-3 bg-white relative group">Group Name<div onMouseDown={handleResizeMouseDown('group_name')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                            {visibleColumns.sku && <th style={{ width: colWidthsRef.current.sku, minWidth: colWidthsRef.current.sku }} className="px-4 py-3 bg-white relative group">SKU<div onMouseDown={handleResizeMouseDown('sku')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                            {visibleColumns.title && <th style={{ width: colWidthsRef.current.title, minWidth: colWidthsRef.current.title, maxWidth: colWidthsRef.current.title }} className="px-4 py-3 bg-white relative group">Title<div onMouseDown={handleResizeMouseDown('title')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                            {visibleColumns.category && <th style={{ width: colWidthsRef.current.category, minWidth: colWidthsRef.current.category }} className="px-4 py-3 bg-white relative group">Category<div onMouseDown={handleResizeMouseDown('category')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30 transition-colors" /></th>}
                        </>
                    )}

                    {!collapsedGroups.initialWH && (
                        <>
                            {visibleColumns.int_wh && <th style={{ width: colWidthsRef.current.int_wh, minWidth: colWidthsRef.current.int_wh }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-blue-50 relative group">Int - WH<div onMouseDown={handleResizeMouseDown('int_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.dec_wh && <th style={{ width: colWidthsRef.current.dec_wh, minWidth: colWidthsRef.current.dec_wh }} className="px-4 py-3 text-center bg-blue-50 relative group">Dec - WH<div onMouseDown={handleResizeMouseDown('dec_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.non_apron_qty && <th style={{ width: colWidthsRef.current.non_apron_qty, minWidth: colWidthsRef.current.non_apron_qty }} className="px-4 py-3 text-center bg-blue-50 relative group">Non Apron Qty<div onMouseDown={handleResizeMouseDown('non_apron_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                        </>
                    )}

                    {!collapsedGroups.variants && (
                        <>
                            {visibleColumns.sky_blue && <th style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/50 bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>Sky Blue</div><div onMouseDown={handleResizeMouseDown('sky_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.dark_blue && <th style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1E40AF]"></span>Dark Blue</div><div onMouseDown={handleResizeMouseDown('dark_blue')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.brown && <th style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#92400E]"></span>Brown</div><div onMouseDown={handleResizeMouseDown('brown')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.green && <th style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#22B573]"></span>Green</div><div onMouseDown={handleResizeMouseDown('green')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.tan && <th style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D2B48C]"></span>Tan</div><div onMouseDown={handleResizeMouseDown('tan')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.black && <th style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1C2340]"></span>Black</div><div onMouseDown={handleResizeMouseDown('black')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.red && <th style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E74C3C]"></span>Red</div><div onMouseDown={handleResizeMouseDown('red')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.grey && <th style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center bg-purple-50 relative group"><div className="flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#9CA3AF]"></span>Grey</div><div onMouseDown={handleResizeMouseDown('grey')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                        </>
                    )}

                    {!collapsedGroups.specs && (
                        <>
                            {visibleColumns.weight && <th style={{ width: colWidthsRef.current.weight, minWidth: colWidthsRef.current.weight }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/50 bg-green-50 relative group">Weight<div onMouseDown={handleResizeMouseDown('weight')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.total_weight && <th style={{ width: colWidthsRef.current.total_weight, minWidth: colWidthsRef.current.total_weight }} className="px-4 py-3 text-center bg-green-50 relative group">Total Weight<div onMouseDown={handleResizeMouseDown('total_weight')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.hsn && <th style={{ width: colWidthsRef.current.hsn, minWidth: colWidthsRef.current.hsn }} className="px-4 py-3 text-center bg-green-50 relative group">HSN<div onMouseDown={handleResizeMouseDown('hsn')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.gst && <th style={{ width: colWidthsRef.current.gst, minWidth: colWidthsRef.current.gst }} className="px-4 py-3 text-center bg-green-50 relative group">GST<div onMouseDown={handleResizeMouseDown('gst')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.cost && <th style={{ width: colWidthsRef.current.cost, minWidth: colWidthsRef.current.cost }} className="px-4 py-3 text-center bg-green-50 text-[#22B573] font-bold relative group">COST<div onMouseDown={handleResizeMouseDown('cost')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                        </>
                    )}

                    {!collapsedGroups.logistics && (
                        <>
                            {visibleColumns.ref_sku && <th style={{ width: colWidthsRef.current.ref_sku, minWidth: colWidthsRef.current.ref_sku }} className="px-4 py-3 border-l border-[#D9DDE5]/50 bg-orange-50 font-semibold text-[#1C2340] relative group">SKU (Ref)<div onMouseDown={handleResizeMouseDown('ref_sku')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.ref_title && <th style={{ width: colWidthsRef.current.ref_title, minWidth: colWidthsRef.current.ref_title, maxWidth: colWidthsRef.current.ref_title }} className="px-4 py-3 bg-orange-50 font-semibold text-[#1C2340] relative group">Title (Ref)<div onMouseDown={handleResizeMouseDown('ref_title')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.tra_qty && <th style={{ width: colWidthsRef.current.tra_qty, minWidth: colWidthsRef.current.tra_qty }} className="px-4 py-3 text-center bg-orange-50 relative group">Tra. Qty<div onMouseDown={handleResizeMouseDown('tra_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.quantity && <th style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3 text-center bg-orange-50 relative group">Quantity<div onMouseDown={handleResizeMouseDown('quantity')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.available_qty && <th style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3 text-center bg-orange-50 text-[#5A5DF6] font-bold relative group">Available Qty<div onMouseDown={handleResizeMouseDown('available_qty')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.fc_id && <th style={{ width: colWidthsRef.current.fc_id, minWidth: colWidthsRef.current.fc_id }} className="px-4 py-3 text-center bg-orange-50 relative group">FC ID<div onMouseDown={handleResizeMouseDown('fc_id')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.sale_total && <th style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-Total<div onMouseDown={handleResizeMouseDown('sale_total')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.sale_wh && <th style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Sale-WH<div onMouseDown={handleResizeMouseDown('sale_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.ship_wh && <th style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center bg-orange-50 relative group">Ship - WH<div onMouseDown={handleResizeMouseDown('ship_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.sum_val && <th style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center bg-orange-50 relative group">Sum<div onMouseDown={handleResizeMouseDown('sum_val')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] z-30" /></th>}
                            {visibleColumns.final_wh && <th style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className="px-4 py-3 text-center bg-orange-50 font-bold text-[#E74C3C] relative group">Final - WH<div onMouseDown={handleResizeMouseDown('final_wh')} className="absolute right-0 top-1 bottom-1 w-[2px] bg-[#D9DDE5] cursor-col-resize hover:bg-[#5A5DF6] active:bg-[#5A5DF6] z-30" /></th>}
                        </>
                    )}
                </tr>
            </thead>

            <tbody className="bg-white">
                {filteredData.map((row) => {
                    // REAL-TIME EXCEL MATH
                    const liveAfsDays = Number(masterData.afs_days) || 0;
                    const livePlanDays = Number(masterData.shipment_plan_days) || 0;

                    let liveShipWh = 0;
                    if (liveAfsDays > 0) {
                        liveShipWh = Math.ceil(((row.sale_wh / liveAfsDays) * livePlanDays) - row.available_qty);
                    }

                    return (
                        <tr key={row.id} className={`hover:bg-[#F4F5F7]/80 transition-colors text-[#1C2340]/80 ${typeof activeText !== 'undefined' ? activeText : 'text-xs'}`}>

                            {/* 1. Product Identification Cells */}
                            {collapsedGroups.product ? (
                                <td className="bg-[#F4F5F7]/40 border-r border-[#D9DDE5]/40"></td>
                            ) : (
                                <>
                                    {visibleColumns.group_name && <td style={{ width: colWidthsRef.current.group_name, minWidth: colWidthsRef.current.group_name }} className="px-4 py-3 font-semibold text-[#1C2340]">{row.group_name}</td>}
                                    {visibleColumns.sku && <td style={{ width: colWidthsRef.current.sku, minWidth: colWidthsRef.current.sku }} className="px-4 py-3"><span className="bg-[#F4F5F7] border border-[#D9DDE5] px-2 py-1 rounded-[3px] font-medium">{row.sku}</span></td>}
                                    {visibleColumns.title && <td
                                        onDoubleClick={() => handleDoubleClick(row.id, 'title')}
                                        style={{ width: colWidthsRef.current.title, minWidth: colWidthsRef.current.title, maxWidth: colWidthsRef.current.title }}
                                        className={`px-4 py-3 cursor-pointer transition-all duration-300 ${expandedCell?.rowId === row.id && expandedCell?.colName === 'title' ? 'whitespace-normal break-words bg-white shadow-sm' : 'truncate'}`}
                                        title="Double click to expand"
                                    >
                                        {row.title}
                                    </td>}
                                    {visibleColumns.category && <td style={{ width: colWidthsRef.current.category, minWidth: colWidthsRef.current.category }} className="px-4 py-3">{row.category}</td>}
                                </>
                            )}

                            {/* 2. Initial WH Cells */}
                            {collapsedGroups.initialWH ? (
                                <td className="bg-blue-50/20 border-r border-[#D9DDE5]/40"></td>
                            ) : (
                                <>
                                    {visibleColumns.int_wh && <td style={{ width: colWidthsRef.current.int_wh, minWidth: colWidthsRef.current.int_wh }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/30 font-semibold">{row.int_wh}</td>}
                                    {visibleColumns.dec_wh && <td style={{ width: colWidthsRef.current.dec_wh, minWidth: colWidthsRef.current.dec_wh }} className="px-4 py-3 text-center">{row.dec_wh}</td>}
                                    {visibleColumns.non_apron_qty && <td style={{ width: colWidthsRef.current.non_apron_qty, minWidth: colWidthsRef.current.non_apron_qty }} className="px-4 py-3 text-center">{row.non_apron_qty}</td>}
                                </>
                            )}

                            {/* 3. Variants Mapping Cells */}
                            {collapsedGroups.variants ? (
                                <td className="bg-purple-50/20 border-r border-[#D9DDE5]/40"></td>
                            ) : (
                                <>
                                    {visibleColumns.sky_blue && <td style={{ width: colWidthsRef.current.sky_blue, minWidth: colWidthsRef.current.sky_blue }} className="px-3 py-3 text-center border-l border-[#D9DDE5]/30">{row.apr_sky_blue ? <span className="font-bold text-[#38BDF8] bg-[#38BDF8]/10 px-2 py-0.5 rounded-[3px]">{row.apr_sky_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.dark_blue && <td style={{ width: colWidthsRef.current.dark_blue, minWidth: colWidthsRef.current.dark_blue }} className="px-3 py-3 text-center">{row.apr_dark_blue ? <span className="font-bold text-[#1E40AF] bg-[#1E40AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_dark_blue}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.brown && <td style={{ width: colWidthsRef.current.brown, minWidth: colWidthsRef.current.brown }} className="px-3 py-3 text-center">{row.apr_brown ? <span className="font-bold text-[#92400E] bg-[#92400E]/10 px-2 py-0.5 rounded-[3px]">{row.apr_brown}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.green && <td style={{ width: colWidthsRef.current.green, minWidth: colWidthsRef.current.green }} className="px-3 py-3 text-center">{row.apr_green ? <span className="font-bold text-[#22B573] bg-[#22B573]/10 px-2 py-0.5 rounded-[3px]">{row.apr_green}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.tan && <td style={{ width: colWidthsRef.current.tan, minWidth: colWidthsRef.current.tan }} className="px-3 py-3 text-center">{row.apr_tan ? <span className="font-bold text-[#D2B48C] bg-[#D2B48C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_tan}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.black && <td style={{ width: colWidthsRef.current.black, minWidth: colWidthsRef.current.black }} className="px-3 py-3 text-center">{row.apr_black ? <span className="font-bold text-[#1C2340] bg-[#1C2340]/10 px-2 py-0.5 rounded-[3px]">{row.apr_black}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.red && <td style={{ width: colWidthsRef.current.red, minWidth: colWidthsRef.current.red }} className="px-3 py-3 text-center">{row.apr_red ? <span className="font-bold text-[#E74C3C] bg-[#E74C3C]/10 px-2 py-0.5 rounded-[3px]">{row.apr_red}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                    {visibleColumns.grey && <td style={{ width: colWidthsRef.current.grey, minWidth: colWidthsRef.current.grey }} className="px-3 py-3 text-center">{row.apr_grey ? <span className="font-bold text-[#9CA3AF] bg-[#9CA3AF]/10 px-2 py-0.5 rounded-[3px]">{row.apr_grey}</span> : <span className="text-[#1C2340]/30">-</span>}</td>}
                                </>
                            )}

                            {/* 4. Specs & Financials Cells */}
                            {collapsedGroups.specs ? (
                                <td className="bg-green-50/20 border-r border-[#D9DDE5]/40"></td>
                            ) : (
                                <>
                                    {visibleColumns.weight && <td style={{ width: colWidthsRef.current.weight, minWidth: colWidthsRef.current.weight }} className="px-4 py-3 text-center border-l border-[#D9DDE5]/30">{row.weight}</td>}
                                    {visibleColumns.total_weight && <td style={{ width: colWidthsRef.current.total_weight, minWidth: colWidthsRef.current.total_weight }} className="px-4 py-3 text-center">{row.total_weight}</td>}
                                    {visibleColumns.hsn && <td style={{ width: colWidthsRef.current.hsn, minWidth: colWidthsRef.current.hsn }} className="px-4 py-3 text-center">{row.hsn || '-'}</td>}
                                    {visibleColumns.gst && <td style={{ width: colWidthsRef.current.gst, minWidth: colWidthsRef.current.gst }} className="px-4 py-3 text-center">{row.gst || '-'}</td>}
                                    {visibleColumns.cost && <td style={{ width: colWidthsRef.current.cost, minWidth: colWidthsRef.current.cost }} className="px-4 py-3 text-center font-bold text-[#22B573]">₹{row.cost}</td>}
                                </>
                            )}

                            {/* 5. Logistics & Calculation Cells */}
                            {collapsedGroups.logistics ? (
                                <td className="bg-orange-50/20 border-r border-[#D9DDE5]/40"></td>
                            ) : (
                                <>
                                    {visibleColumns.ref_sku && <td style={{ width: colWidthsRef.current.ref_sku, minWidth: colWidthsRef.current.ref_sku }} className="px-4 py-3 border-l border-[#D9DDE5]/30 font-medium truncate">{row.ref_sku}</td>}
                                    {visibleColumns.ref_title && <td
                                        onDoubleClick={() => handleDoubleClick(row.id, 'ref_title')}
                                        style={{ width: colWidthsRef.current.ref_title, minWidth: colWidthsRef.current.ref_title, maxWidth: colWidthsRef.current.ref_title }}
                                        className={`px-4 py-3 font-medium cursor-pointer transition-all duration-300 ${expandedCell?.rowId === row.id && expandedCell?.colName === 'ref_title' ? 'whitespace-normal break-words bg-white shadow-sm' : 'truncate'}`}
                                        title="Double click to expand"
                                    >
                                        {row.ref_title}
                                    </td>}
                                    {visibleColumns.tra_qty && <td style={{ width: colWidthsRef.current.tra_qty, minWidth: colWidthsRef.current.tra_qty }} className="px-4 py-3 text-center font-semibold text-[#5A5DF6]">{row.tra_qty}</td>}
                                    {visibleColumns.quantity && <td style={{ width: colWidthsRef.current.quantity, minWidth: colWidthsRef.current.quantity }} className="px-4 py-3 text-center">{row.quantity}</td>}
                                    {visibleColumns.available_qty && <td style={{ width: colWidthsRef.current.available_qty, minWidth: colWidthsRef.current.available_qty }} className="px-4 py-3 text-center font-bold text-[#1C2340] bg-[#F4F5F7]/50">{row.available_qty}</td>}
                                    {visibleColumns.fc_id && <td style={{ width: colWidthsRef.current.fc_id, minWidth: colWidthsRef.current.fc_id }} className="px-4 py-3 text-center"><span className="bg-[#D9DDE5]/40 px-2 py-0.5 rounded-[3px] text-[10px]">{row.ixd_ixd_fulfilment_id}</span></td>}
                                    {visibleColumns.sale_total && <td style={{ width: colWidthsRef.current.sale_total, minWidth: colWidthsRef.current.sale_total }} className="px-4 py-3 text-center">{row.sale_total}</td>}
                                    {visibleColumns.sale_wh && <td style={{ width: colWidthsRef.current.sale_wh, minWidth: colWidthsRef.current.sale_wh }} className="px-4 py-3 text-center">{row.sale_wh}</td>}

                                    {visibleColumns.ship_wh && <td style={{ width: colWidthsRef.current.ship_wh, minWidth: colWidthsRef.current.ship_wh }} className="px-4 py-3 text-center flex items-center justify-center gap-1">
                                        {liveShipWh < 0 ? <TrendingDown size={12} className="text-[#E74C3C]" /> : <TrendingUp size={12} className="text-[#22B573]" />}
                                        <span className={liveShipWh < 0 ? "text-[#E74C3C] font-semibold" : ""}>{liveShipWh}</span>
                                    </td>}
                                    {visibleColumns.sum_val && <td style={{ width: colWidthsRef.current.sum_val, minWidth: colWidthsRef.current.sum_val }} className="px-4 py-3 text-center">{row.sum_val}</td>}

                                    {/* Inline Editable Final WH */}
                                    {visibleColumns.final_wh && <td style={{ width: colWidthsRef.current.final_wh, minWidth: colWidthsRef.current.final_wh }} className="px-4 py-3 text-center bg-orange-50/30">
                                        <input
                                            type="number"
                                            value={row.final_wh === "" ? "" : row.final_wh}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setCalculationData(prev => prev.map(p => p.id === row.id ? { ...p, final_wh: val, is_manual_final_wh: 1 } : p));
                                                handleItemAutoSave(row.id, val);
                                            }}
                                            className="w-14 text-center font-bold bg-transparent border-b border-transparent hover:border-[#D9DDE5] focus:border-[#5A5DF6] outline-none transition-colors"
                                            style={{ color: row.is_manual_final_wh ? '#5A5DF6' : '#1C2340' }}
                                        />
                                    </td>}
                                </>
                            )}

                            {/* ACTION COLUMN CELL */}
                            <td className="w-20 px-3 py-3 text-center bg-white border-l border-[#D9DDE5]/30">
                                <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => startEditing(row)} title="Edit SKU" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                        <Pencil size={14} />
                                    </button>
                                    <button onClick={() => handleDeleteRow(row.id)} title="Delete Row" className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>

                        </tr>
                    );
                })}
            </tbody>
        </table>
    )}
</div>