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
    resetFinalWh
} = require("../../controller/calculation/calculation");

router.get("/getCalculationData", (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
}, getCalculationData); // <--- GET Route (no-cache header add kiya)
router.post("/upload", upload.single("file"), uploadCalculationReport);
router.post("/manual-add", addManualCalculationRow);

router.delete("/delete-row/:id", deleteCalculationRow);

router.put("/edit-row", editCalculationRow);
router.put("/update-master", updateMasterData);
router.put("/update-item-final-wh", updateItemFinalWh);
router.put("/reset-final-wh", resetFinalWh);


module.exports = router;
