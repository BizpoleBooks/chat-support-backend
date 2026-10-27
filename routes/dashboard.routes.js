const express = require("express");
const router = express.Router();
const { getDashboardStats, getRecentTenants, getRecentActivities, getWeeklyStats } = require("../services/dashboard.service");

router.get("/", async (req, res) => {
  try {
    const user = req.user;
    const stats = await getDashboardStats(user);
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Dashboard failed" });
  }
});

router.get("/recent-tenants", async (req, res) => {
  try {
    const tenants = await getRecentTenants(5);
    res.json(tenants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

router.get("/recent-activities", async (req, res) => {
  try {
    const activities = await getRecentActivities(5);
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.get("/weekly-stats", async (req, res) => {
  try {
    const stats = await getWeeklyStats();
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;