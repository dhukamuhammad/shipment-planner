const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

const getActiveMarketplaces = async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query(
            `SELECT id, name FROM marketplaces WHERE is_active = 1 ORDER BY name ASC`
        );
        connection.release();
        return successResponse(res, "Marketplaces fetched successfully", rows, 200);
    } catch (error) {
        console.error("Fetch Marketplaces Error:", error);
        return errorResponse(res, "Failed to fetch marketplaces", 500);
    }
};

const addMarketplace = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return errorResponse(res, "Marketplace name is required", 400);

        const connection = await db.getConnection();
        const [result] = await connection.query(`INSERT INTO marketplaces (name) VALUES (?)`, [name]);
        connection.release();

        return successResponse(res, "Marketplace added successfully", { id: result.insertId, name }, 201);
    } catch (error) {
        console.error("Add Marketplace Error:", error);
        return errorResponse(res, "Failed to add marketplace", 500);
    }
};

const updateMarketplace = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return errorResponse(res, "Marketplace name is required", 400);

        const connection = await db.getConnection();
        await connection.query(`UPDATE marketplaces SET name = ? WHERE id = ?`, [name, id]);
        connection.release();

        return successResponse(res, "Marketplace updated successfully", { id, name }, 200);
    } catch (error) {
        console.error("Update Marketplace Error:", error);
        return errorResponse(res, "Failed to update marketplace", 500);
    }
};

const deleteMarketplace = async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await db.getConnection();
        // Option 1: Soft Delete
        // await connection.query(`UPDATE marketplaces SET is_active = 0 WHERE id = ?`, [id]);
        
        // Option 2: Hard Delete (Since ON DELETE SET NULL is there, this is safe)
        await connection.query(`DELETE FROM marketplaces WHERE id = ?`, [id]);
        connection.release();

        return successResponse(res, "Marketplace deleted successfully", { id }, 200);
    } catch (error) {
        console.error("Delete Marketplace Error:", error);
        return errorResponse(res, "Failed to delete marketplace", 500);
    }
};

module.exports = {
    getActiveMarketplaces,
    addMarketplace,
    updateMarketplace,
    deleteMarketplace
};
