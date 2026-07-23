const express = require("express");
const { getSettings, updateSetting } = require("../../controller/settings/settings");

const router = express.Router();

router.get("/settings", getSettings);
router.post("/settings", updateSetting);

module.exports = router;
