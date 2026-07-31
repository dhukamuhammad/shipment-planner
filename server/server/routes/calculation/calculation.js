const express = require("express");
const router = express.Router();
const upload = require("../../middleware/multer");
const {
    uploadCalculationReport,
    addManualCalculationRow,
    editCalculationRow,
    deleteCalculationRow,
    getCalculationData,
    updateMasterData,
    updateItemFinalWh,
    updateItemSuggestWh,
    resetFinalWh,
    getManifestDetails,
    getCalculationHistory,
    deleteCalculationPlan,
    applyEventMultiplier
} = require("../../controller/calculation/calculation");

router.get("/getCalculationData", (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
}, getCalculationData); 

router.get("/history", getCalculationHistory);
router.get("/getManifestDetails", getManifestDetails);

router.post("/upload", upload.single("file"), uploadCalculationReport);
router.post("/manual-add", addManualCalculationRow);

router.delete("/delete-row/:id", deleteCalculationRow);
router.delete("/delete-plan/:id", deleteCalculationPlan);

router.put("/edit-row", editCalculationRow);
router.put("/update-master", updateMasterData); // Master row data update karne ke liye
router.put("/update-item-final-wh", updateItemFinalWh);
router.put("/update-item-suggest-wh", updateItemSuggestWh);
router.put("/reset-final-wh", resetFinalWh);
router.put("/apply-event-multiplier", applyEventMultiplier);


module.exports = router;
