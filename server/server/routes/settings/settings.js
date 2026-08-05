const express = require("express");
const { getSettings, updateSetting, getIxdWarehouses, toggleIxdWarehouse, addIxdWarehouse, editIxdWarehouse, deleteIxdWarehouse } = require("../../controller/settings/settings");

const router = express.Router();

router.get("/settings", getSettings);
router.post("/settings", updateSetting);

router.get("/ixd-warehouses", getIxdWarehouses);
router.post("/ixd-warehouses/toggle", toggleIxdWarehouse);
router.post("/ixd-warehouses/add", addIxdWarehouse);
router.put("/ixd-warehouses/:id", editIxdWarehouse);
router.delete("/ixd-warehouses/:id", deleteIxdWarehouse);

module.exports = router;
