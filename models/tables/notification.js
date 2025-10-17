const pool = require("../../config/db");
// const { notification_status } = require("../enums");

async function createNotificationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Notification (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      student_id UUID REFERENCES Student(id) ON DELETE CASCADE,
      status notification_status NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notification_student_id ON Notification(student_id);
  `);

  await pool.query(`
    CREATE TRIGGER set_updated_at_notification
    BEFORE UPDATE ON Notification
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `);
}

module.exports = createNotificationTable;
