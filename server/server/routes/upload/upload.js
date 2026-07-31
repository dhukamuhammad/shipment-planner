const express = require("express");
const router = express.Router();

// Middleware import kar liya
const upload = require("../../middleware/multer");
const { uploadAFSReport, uploadBusinessReport, uploadDIHReport, getRecentUploads, deleteReport, uploadTransitShipmentReport, getAllReports, autoUploadReport } = require("../../controller/upload/upload");

router.get("/recent", getRecentUploads);
router.get('/all-reports', getAllReports);
router.post("/auto", upload.single("file"), autoUploadReport);
router.post("/afs", upload.single("file"), uploadAFSReport);
router.post("/business", upload.single("file"), uploadBusinessReport);
router.post("/dih", upload.single("file"), uploadDIHReport);
router.post("/transit", upload.single("file"), uploadTransitShipmentReport);

router.delete("/:id", deleteReport);

module.exports = router;