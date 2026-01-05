const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serves frontend files from the 'public' folder

// --- 1. DATABASE CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root', // ⚠️ Ensure this matches your MySQL password
    database: 'expense_tracker'
});

db.connect(err => {
    if (err) {
        console.error('❌ Database connection failed: ' + err.stack);
        return;
    }
    console.log('✅ Connected to MySQL database.');
});

// --- 2. EMAIL CONFIGURATION (Nodemailer) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'chikilekumari1417@gmail.com', 
        pass: 'txor ykpc nbap hquf' // 16-digit Gmail App Password
    }
});

// --- 3. EXPENSE MODULE ROUTES ---

// GET: Fetch all expenses (Sorted by newest date)
app.get('/api/expenses', (req, res) => {
    const sql = 'SELECT * FROM expenses ORDER BY expense_date DESC, id DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST: Add a new expense
app.post('/api/expenses', (req, res) => {
    const { title, amount, category, expense_date } = req.body;
    const sql = 'INSERT INTO expenses (title, amount, category, expense_date) VALUES (?, ?, ?, ?)';
    
    db.query(sql, [title, amount, category, expense_date], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: result.insertId, title, amount, category, expense_date });
    });
});

// GET: Filter expenses by month (Format expected from UI: YYYY-MM)
app.get('/api/expenses/filter/:month', (req, res) => {
    const selectedMonth = req.params.month; 
    const sql = "SELECT * FROM expenses WHERE DATE_FORMAT(expense_date, '%Y-%m') = ? ORDER BY expense_date DESC";
    
    db.query(sql, [selectedMonth], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// DELETE: Remove an expense by ID
app.delete('/api/expenses/:id', (req, res) => {
    db.query('DELETE FROM expenses WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Expense deleted successfully' });
    });
});

// --- 4. REMINDER MODULE ROUTES ---

// GET: Fetch all bill reminders (Sorted by upcoming due date)
app.get('/api/reminders', (req, res) => {
    db.query('SELECT * FROM reminders ORDER BY due_date ASC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST: Set a new bill reminder
app.post('/api/reminders', (req, res) => {
    const { bill_name, due_date, user_email } = req.body;
    const sql = 'INSERT INTO reminders (bill_name, due_date, user_email) VALUES (?, ?, ?)';
    db.query(sql, [bill_name, due_date, user_email], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Reminder set successfully", id: result.insertId });
    });
});

// DELETE: Remove a reminder by ID
app.delete('/api/reminders/:id', (req, res) => {
    const reminderId = req.params.id;
    const sql = 'DELETE FROM reminders WHERE id = ?';
    
    db.query(sql, [reminderId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Reminder deleted successfully' });
    });
});

// --- 5. AUTOMATED CRON JOB (Email Service) ---
// Runs every minute to check for bills due TODAY
cron.schedule('* * * * *', () => {
    console.log('🔍 Scanning database for pending reminders due today...');
    
    // Selects bills due on current date that haven't been sent
    const sql = "SELECT * FROM reminders WHERE DATE(due_date) = CURDATE() AND is_sent = FALSE";
    
    db.query(sql, (err, results) => {
        if (err) return console.error('Cron Job Error:', err);
        
        results.forEach(bill => {
            const mailOptions = {
                from: 'chikilekumari1417@gmail.com',
                to: bill.user_email,
                subject: `🔔 Payment Reminder: ${bill.bill_name}`,
                text: `Greetings! This is an automated reminder to pay your bill: ${bill.bill_name}.\nScheduled Due Date: ${bill.due_date}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('❌ Email failed for ID ' + bill.id + ': ' + error);
                } else {
                    console.log('📧 Reminder email dispatched: ' + info.response);
                    // Mark as sent in DB to prevent duplicate emails
                    db.query('UPDATE reminders SET is_sent = TRUE WHERE id = ?', [bill.id]);
                }
            });
        });
    });
});

// --- 6. SERVER INITIALIZATION ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server fully operational at http://localhost:${PORT}`);
});