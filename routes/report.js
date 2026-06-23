const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');
const authMiddleware = require('../middleware/auth');

// 1. GET REPORT DATA
router.get('/date/:date', authMiddleware, async (req, res) => {
    try {
        const date = req.params.date;
        const result = await pool.query(
            `
            SELECT
                c.customer_name,
                p.amount,
                p.payment_mode,
                p.collection_date
            FROM pigmy_collections p
            INNER JOIN customers c ON p.customer_id = c.id
            WHERE CAST(p.collection_date AS DATE) = $1 AND p.user_id = $2
            ORDER BY c.customer_name
            `,
            [date, req.userId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 2. EXPORT TO EXCEL
router.get('/export/:date', authMiddleware, async (req, res) => {
    try {
        const date = req.params.date;
        const result = await pool.query(
            `
            SELECT
                c.customer_name,
                p.amount,
                p.payment_mode
            FROM pigmy_collections p
            INNER JOIN customers c ON p.customer_id = c.id
            WHERE CAST(p.collection_date AS DATE) = $1 AND p.user_id = $2
            ORDER BY c.customer_name
            `,
            [date, req.userId]
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pigmy Report');

        worksheet.columns = [
            { header: 'Customer Name', key: 'customer_name', width: 30 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Payment Mode', key: 'payment_mode', width: 20 }
        ];

        let total = 0;
        result.rows.forEach(row => {
            total += Number(row.amount);
            worksheet.addRow(row);
        });

        worksheet.addRow([]);
        worksheet.addRow({
            customer_name: 'TOTAL',
            amount: total
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Pigmy_Report_${date}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 3. SEND WHATSAPP (Table Formatted Text Engine)
router.post('/send-whatsapp', authMiddleware, async (req, res) => {
    try {
        const { date, mobile } = req.body;

        if (!date) {
            return res.status(400).json({ success: false, message: 'Please Select Date' });
        }
        if (!mobile) {
            return res.status(400).json({ success: false, message: 'Please Enter WhatsApp Number' });
        }

        const result = await pool.query(
            `
            SELECT
                c.customer_name,
                p.amount,
                p.payment_mode
            FROM pigmy_collections p
            INNER JOIN customers c ON p.customer_id = c.id
            WHERE CAST(p.collection_date AS DATE) = $1 AND p.user_id = $2
            ORDER BY c.customer_name
            `,
            [date, req.userId]
        );

        // Header Structure Setup
        let titleBlock = `📊 *PIGMY COLLECTION REPORT*\n📅 *Date:* ${date}\n\n`;
        
        // Fixed-width Courier Font starts with ```
        let tableBlock = "```\n";
        tableBlock += "-----------------------------\n";
        tableBlock += "Cust Name      | Amt  | Mode \n";
        tableBlock += "-----------------------------\n";

        let total = 0;

        result.rows.forEach((row) => {
            total += Number(row.amount);

            // Substring up to 14 chars to avoid layout break
            let name = row.customer_name.substring(0, 14);
            let amt = String(row.amount).substring(0, 5);
            let mode = String(row.payment_mode).substring(0, 4);

            // Padding calculation for consistent matrix grids
            let paddedName = name.padEnd(14, ' ');
            let paddedAmt = amt.padEnd(5, ' ');
            let paddedMode = mode.padEnd(4, ' ');

            tableBlock += `${paddedName} | ${paddedAmt} | ${paddedMode}\n`;
        });

        tableBlock += "-----------------------------\n";
        
        let totalLabel = "TOTAL".padEnd(14, ' ');
        let totalAmtStr = String(total).padEnd(5, ' ');
        tableBlock += `${totalLabel} | ${totalAmtStr} | -\n`;
        tableBlock += "-----------------------------\n";
        tableBlock += "```"; // Fixed-width closing block

        // Merge Metadata with the raw string matrix
        let finalMessage = titleBlock + tableBlock;

        res.json({
            success: true,
            whatsappNumber: mobile,
            message: finalMessage
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;