const express = require('express');
const router = express.Router();
const upload = require("../../middleware/multer");
const manifestController = require('../../controller/manifest/manifest');


router.get('/check-manifest-template', manifestController.checkTemplateStatus);
router.post('/upload-template', upload.single('file'), manifestController.uploadTemplate);
// 🔥 YEH LINE ZAROORI HAI EXPORT KE LIYE
router.post('/download-manifest', manifestController.downloadManifest);

module.exports = router;