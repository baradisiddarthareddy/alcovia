const express = require("express");
const router = express.Router();
const db = require("../db");
const axios = require("axios");
require("dotenv").config();

// ✅ 1. DAILY CHECKIN
router.post("/daily-checkin", (req, res) => {
  const { student_id, quiz_score, focus_minutes } = req.body;

  // insert log
  db.query(
    "INSERT INTO daily_logs (student_id, quiz_score, focus_minutes) VALUES (?, ?, ?)",
    [student_id, quiz_score, focus_minutes]
  );

  // ✅ logic evaluation
  if (quiz_score > 7 && focus_minutes > 60) {
    db.query("UPDATE students SET status='On Track' WHERE id=?", [student_id]);
    return res.json({ status: "On Track" });
  }

  // ✅ failed → needs intervention
  db.query("UPDATE students SET status='Needs Intervention' WHERE id=?", [
    student_id,
  ]);

  // ✅ trigger n8n webhook
  axios
    .post(process.env.N8N_WEBHOOK_URL, {
      student_id,
      quiz_score,
      focus_minutes,
    })
    .catch((err) => console.log("N8N Error:", err));

  return res.json({ status: "Pending Mentor Review" });
});

// ✅ 2. ASSIGN INTERVENTION (called by n8n)
router.post("/assign-intervention", (req, res) => {
  const { student_id, task } = req.body;

  db.query("INSERT INTO interventions (student_id, task) VALUES (?, ?)", [
    student_id,
    task,
  ]);

  db.query("UPDATE students SET status='Remedial' WHERE id=?", [student_id]);

  return res.json({ status: "Remedial Assigned", task });
});

// ✅ 3. MARK COMPLETE (student action)
router.post("/complete-task", (req, res) => {
  const { student_id } = req.body;

  db.query(
    "UPDATE interventions SET status='Completed' WHERE student_id=? ORDER BY id DESC LIMIT 1",
    [student_id]
  );

  db.query("UPDATE students SET status='On Track' WHERE id=?", [student_id]);

  return res.json({ status: "On Track" });
});

module.exports = router;
