const db = require("../../config/db");
const { successResponse, errorResponse } = require("../../utils/responseFormatter");

// Get all events
const getEvents = async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query(`SELECT * FROM events_calendar ORDER BY start_date ASC`);
        connection.release();
        return successResponse(res, "Events fetched successfully", rows, 200);
    } catch (error) {
        console.error("Get Events Error:", error);
        return errorResponse(res, "Failed to fetch events", 500);
    }
};

// Add new event
const addEvent = async (req, res) => {
    try {
        const { event_name, start_date, end_date, multiplier, marketplace_id, remind_before_value, remind_before_unit } = req.body;
        
        if (!event_name || !start_date || !end_date) {
            return errorResponse(res, "Event name, start date, and end date are required", 400);
        }

        const connection = await db.getConnection();
        const [result] = await connection.query(
            `INSERT INTO events_calendar (event_name, start_date, end_date, multiplier, marketplace_id, remind_before_value, remind_before_unit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                event_name,
                start_date,
                end_date,
                multiplier || 1.0,
                marketplace_id || null,
                remind_before_value != null ? remind_before_value : 3,
                remind_before_unit || 'days'
            ]
        );
        connection.release();
        
        return successResponse(res, "Event added successfully", { id: result.insertId }, 201);
    } catch (error) {
        console.error("Add Event Error:", error);
        return errorResponse(res, "Failed to add event", 500);
    }
};

// Update event
const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { event_name, start_date, end_date, multiplier, marketplace_id, remind_before_value, remind_before_unit } = req.body;
        
        const connection = await db.getConnection();
        await connection.query(
            `UPDATE events_calendar SET event_name=?, start_date=?, end_date=?, multiplier=?, marketplace_id=?, remind_before_value=?, remind_before_unit=? WHERE id=?`,
            [
                event_name,
                start_date,
                end_date,
                multiplier,
                marketplace_id || null,
                remind_before_value != null ? remind_before_value : 3,
                remind_before_unit || 'days',
                id
            ]
        );
        connection.release();
        
        return successResponse(res, "Event updated successfully", null, 200);
    } catch (error) {
        console.error("Update Event Error:", error);
        return errorResponse(res, "Failed to update event", 500);
    }
};

// Delete event
const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        
        const connection = await db.getConnection();
        await connection.query(`DELETE FROM events_calendar WHERE id=?`, [id]);
        connection.release();
        
        return successResponse(res, "Event deleted successfully", null, 200);
    } catch (error) {
        console.error("Delete Event Error:", error);
        return errorResponse(res, "Failed to delete event", 500);
    }
};

module.exports = {
    getEvents,
    addEvent,
    updateEvent,
    deleteEvent
};
