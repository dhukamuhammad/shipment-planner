const express = require("express");
const { getSettings, updateSetting, getIxdWarehouses, toggleIxdWarehouse } = require("../../controller/settings/settings");

const router = express.Router();

router.get("/settings", getSettings);
router.post("/settings", updateSetting);

router.get("/ixd-warehouses", getIxdWarehouses);
router.post("/ixd-warehouses/toggle", toggleIxdWarehouse);

module.exports = router;
