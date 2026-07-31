const express = require("express");
const cors = require("cors");
const compression = require('compression');
require("dotenv").config();

const uploadRoutes = require("./routes/upload/upload");
const calculationRoutes = require("./routes/calculation/calculation");
const stockRoutes = require("./routes/stock/stock");
const manifestRoutes = require("./routes/manifest/manifest");
const marketplaceRoutes = require("./routes/marketplace/marketplace");
const settingsRoutes = require("./routes/settings/settings");
const eventsRoutes = require("./routes/settings/events");

const app = express();

app.use(cors());

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(compression()); // Ye API response ko chota aur superfast bana dega


app.use("/api", uploadRoutes);
app.use("/api", calculationRoutes);
app.use("/api", stockRoutes);  
app.use("/api", manifestRoutes);
app.use("/api", marketplaceRoutes);
app.use("/api", settingsRoutes);
app.use("/api/events", eventsRoutes);



app.get("/", (req, res) => {
    res.send("Crasome API Running...");
});



const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
    console.log(`Server Running On Port ${PORT}`);
    // await runMigrations();
});
