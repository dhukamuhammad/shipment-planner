const express = require("express");
const router = express.Router();
const upload = require("../../middleware/multer");
const { uploadStockReport, getStockAvailability, updateIncomingStock } = require("../../controller/stock/stock");

// Upload new stock report (Available Stock)
router.post("/upload-stock", upload.single("file"), uploadStockReport);
// Get group-wise stock availability
router.get("/getStockAvailability", getStockAvailability);
// Update incoming production stock
router.post("/update-incoming-stock", updateIncomingStock);

module.exports = router;