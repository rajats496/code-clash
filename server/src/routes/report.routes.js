import express from 'express';
import nodemailer from 'nodemailer';
import { Report } from '../models/Report.model.js';

const router = express.Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'www.rajatsri@gmail.com';

/**
 * Create transporter lazily so missing env vars don't crash startup.
 */
const getTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,   // Gmail App Password (16 chars)
    },
  });
};

// ─────────────────────────────────────────
//  POST /api/reports  — submit a report
// ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, description, reporterEmail, reporterName } = req.body;

    if (!type || !description?.trim()) {
      return res.status(400).json({ error: 'Issue type and description are required.' });
    }

    // Resolve reporter info from JWT if present
    let email = reporterEmail || null;
    let name  = reporterName  || null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        email = email || decoded.email || null;
        name  = name  || decoded.name  || null;
      } catch (_) { /* proceed anonymously */ }
    }

    // Save to DB
    const report = await Report.create({
      type,
      description: description.trim(),
      reporterEmail: email,
      reporterName:  name,
    });

    // Send email via Gmail SMTP
    let emailSent = false;
    const transporter = getTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"CodeClash Reports" <${process.env.SMTP_USER}>`,
          to:   ADMIN_EMAIL,
          subject: `[CodeClash] ${type} — Report #${report._id.toString().slice(-6).toUpperCase()}`,
          html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #333;">
    <div style="padding:24px 28px;background:linear-gradient(135deg,#ffa116,#ff7a00);">
      <h2 style="margin:0;color:#1a1a1a;font-size:18px;font-weight:800;">🐛 New Issue Report</h2>
      <p style="margin:4px 0 0;color:#1a1a1a;font-size:12px;opacity:0.7;">CodeClash — User Feedback</p>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="color:#888;padding:6px 0;width:130px;vertical-align:top;">Issue Type:</td>
          <td style="color:#fff;font-weight:600;padding:6px 0;">${type}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:6px 0;vertical-align:top;">Reporter:</td>
          <td style="color:#fff;padding:6px 0;">${name ? `${name} &lt;${email}&gt;` : (email || 'Anonymous')}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:6px 0;vertical-align:top;">Time:</td>
          <td style="color:#fff;padding:6px 0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td>
        </tr>
        <tr>
          <td style="color:#888;padding:6px 0;vertical-align:top;">Report ID:</td>
          <td style="color:#aaa;font-family:monospace;font-size:11px;padding:6px 0;">${report._id}</td>
        </tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#0d0d1a;border-radius:8px;border:1px solid #2a2a3a;">
        <p style="color:#888;margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Description</p>
        <p style="margin:0;color:#e0e0e0;white-space:pre-wrap;line-height:1.7;font-size:13px;">${description.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      </div>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #2a2a3a;font-size:11px;color:#555;text-align:center;">
      Received via CodeClash Report System
    </div>
  </div>
</body>
</html>`,
        });
        emailSent = true;
        report.emailSent = true;
        await report.save();
        console.log(`📧 Report email sent for report ${report._id}`);
      } catch (emailErr) {
        console.error('❌ Email send failed:', emailErr.message);
      }
    } else {
      console.warn('⚠️  SMTP not configured — report saved to DB only (set SMTP_USER & SMTP_PASS in .env)');
    }

    res.status(201).json({
      success: true,
      reportId: report._id,
      emailSent,
    });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to submit report. Please try again.' });
  }
});

export default router;
