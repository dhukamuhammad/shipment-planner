const express = require("express");
const router = express.Router();
const upload = require("../../middleware/multer");
const { uploadStockReport, getStockAvailability } = require("../../controller/stock/stock");

router.post("/upload-stock", upload.single("file"), uploadStockReport);
router.get("/getStockAvailability", getStockAvailability);

module.exports = router;