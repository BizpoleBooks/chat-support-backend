const { db } = require("../config/database");

exports.getDashboardStats = async (user) => {
  // 🧑‍💼 SUPER ADMIN → ALL DATA
  if (user.role === "super_admin") {
    const [[tenantCount]] = await db.query(`SELECT COUNT(*) as count FROM tenants`);
    const [[chatCount]] = await db.query(`SELECT COUNT(*) as count FROM chat_messages`);
    
    const [[ticketStats]] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(status = 'open') as open,
        SUM(status = 'closed') as closed
       FROM tickets`
    );
    
    const [[enquiryStats]] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(status = 'new') as new_count,
        SUM(status = 'approved') as converted
       FROM enquiries`
    );

    return {
      tenants: tenantCount.count,
      chats: chatCount.count,
      tickets: ticketStats,
      enquiries: enquiryStats,
    };
  } 
  // 🏢 TENANT ADMIN → ONLY THEIR DATA
  else {
    const tenantId = user.tenantId;
    
    const [[chatCount]] = await db.query(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE tenant_slug = (SELECT slug FROM tenants WHERE id = ?)`,
      [tenantId]
    );
    
    const [[ticketStats]] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(status = 'open') as open,
        SUM(status = 'closed') as closed
       FROM tickets
       WHERE tenant_slug = (SELECT slug FROM tenants WHERE id = ?)`,
      [tenantId]
    );
    
    const [[enquiryStats]] = await db.query(
      `SELECT 
        COUNT(*) as total,
        SUM(status = 'new') as new_count,
        SUM(status = 'approved') as converted
       FROM enquiries
       WHERE tenant_id = ?`,
      [tenantId]
    );

    return {
      tenants: 1,
      chats: chatCount.count,
      tickets: ticketStats,
      enquiries: enquiryStats,
    };
  }
};

// Get recent tenants
exports.getRecentTenants = async (limit = 5) => {
  const [tenants] = await db.query(`
    SELECT 
      t.id,
      t.name,
      t.slug,
      t.created_at,
      COUNT(DISTINCT tk.id) as ticket_count,
      COUNT(DISTINCT cm.id) as chat_count
    FROM tenants t
    LEFT JOIN tickets tk ON tk.tenant_slug = t.slug
    LEFT JOIN chat_messages cm ON cm.tenant_slug = t.slug
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT ?
  `, [limit]);
  
  return tenants.map(tenant => ({
    name: tenant.name,
    status: tenant.ticket_count > 0 ? "Active" : "Pending",
    plan: determinePlan(tenant),
    users: tenant.ticket_count + tenant.chat_count,
    created_at: tenant.created_at
  }));
};

// Get recent activities
exports.getRecentActivities = async (limit = 5) => {
  const [activities] = await db.query(`
    (SELECT 
      'ticket' as type,
      subject as title,
      created_at as time,
      status,
      priority
    FROM tickets
    ORDER BY created_at DESC
    LIMIT ?)
    
    UNION ALL
    
    (SELECT 
      'conversation' as type,
      LEFT(message, 50) as title,
      created_at as time,
      'completed' as status,
      'medium' as priority
    FROM chat_messages
    ORDER BY created_at DESC
    LIMIT ?)
    
    ORDER BY time DESC
    LIMIT ?
  `, [limit, limit, limit]);
  
  return activities;
};

// Get weekly stats for chart
exports.getWeeklyStats = async () => {
  const [stats] = await db.query(`
    SELECT 
      DATE_FORMAT(created_at, '%a') as name,
      COUNT(*) as users,
      DAYOFWEEK(created_at) as day_order
    FROM chat_messages
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY day_order
  `);
  
  return stats;
};

function determinePlan(tenant) {
  const daysOld = (new Date() - new Date(tenant.created_at)) / (1000 * 60 * 60 * 24);
  if (daysOld < 30) return "Startup";
  if (daysOld < 90) return "Business";
  return "Enterprise";
}