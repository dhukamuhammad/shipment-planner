const express = require("express");
const router = express.Router();
const { getActiveMarketplaces, addMarketplace, updateMarketplace, deleteMarketplace } = require("../../controller/marketplace/marketplace");

router.get("/marketplaces", getActiveMarketplaces);
router.post("/marketplaces", addMarketplace);
router.put("/marketplaces/:id", updateMarketplace);
router.delete("/marketplaces/:id", deleteMarketplace);

module.exports = router;
