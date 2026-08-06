const db = require('./config/db');

const setupLogs = async () => {
    try {
        console.log("Creating activity_logs table...");
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                action VARCHAR(255) NOT NULL,
                module VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );
        `;
        await db.query(createTableQuery);
        console.log("activity_logs table created successfully.");
    } catch (error) {
        console.error("Error setting up activity logs:", error);
    } finally {
        process.exit(0);
    }
};

setupLogs();
