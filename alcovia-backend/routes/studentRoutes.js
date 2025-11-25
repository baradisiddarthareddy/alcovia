const express = require("express");
const router = express.Router();
const db = require("../db");
const axios = require("axios");
require("dotenv").config();

// DAILY CHECKIN
router.post("/daily-checkin", async (req, res) => {
  const { student_id, quiz_score, focus_minutes } = req.body;

  try {
    // Insert daily log
    await db.query(
      "INSERT INTO daily_logs (student_id, quiz_score, focus_minutes) VALUES (?, ?, ?)",
      [student_id, quiz_score, focus_minutes]
    );

    // Check if student is on track
    if (quiz_score > 7 && focus_minutes > 60) {
      await db.query("UPDATE students SET status='On Track' WHERE id=?", [
        student_id,
      ]);
      return res.json({ status: "On Track" });
    }

    // Student failed → needs intervention
    await db.query(
      "UPDATE students SET status='Needs Intervention' WHERE id=?",
      [student_id]
    );

    // Call n8n webhook
    axios
      .post(process.env.N8N_WEBHOOK_URL, {
        student_id,
        quiz_score,
        focus_minutes,
      })
      .catch((err) => console.log("N8N Error:", err.message));

    return res.json({ status: "Pending Mentor Review" });
  } catch (err) {
    console.log("Daily Checkin Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ASSIGN INTERVENTION
router.post("/assign-intervention", async (req, res) => {
  const { student_id, task } = req.body;

  try {
    await db.query(
      "INSERT INTO interventions (student_id, task) VALUES (?, ?)",
      [student_id, task]
    );

    await db.query("UPDATE students SET status='Remedial' WHERE id=?", [
      student_id,
    ]);

    return res.json({ status: "Remedial Assigned", task });
  } catch (err) {
    console.log("Assign Intervention Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// MARK COMPLETE
router.post("/complete-task", async (req, res) => {
  const { student_id } = req.body;

  try {
    await db.query(
      "UPDATE interventions SET status='Completed' WHERE student_id=? ORDER BY id DESC LIMIT 1",
      [student_id]
    );

    await db.query("UPDATE students SET status='On Track' WHERE id=?", [
      student_id,
    ]);

    return res.json({ status: "On Track" });
  } catch (err) {
    console.log("Complete Task Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
