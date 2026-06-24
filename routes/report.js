const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');
const authMiddleware = require('../middleware/auth');

// 1. GET REPORT DATA (Unchanged - separation handled on client side)
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

// 2. EXPORT TO EXCEL (Separated into Cash and Online tables)
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

        // Separate the datasets
        const cashRows = result.rows.filter(row => row.payment_mode === 'Cash');
        const onlineRows = result.rows.filter(row => row.payment_mode !== 'Cash');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pigmy Split Report');

        // Define column structure
        worksheet.columns = [
            { header: 'Customer Name', key: 'customer_name', width: 30 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Payment Mode', key: 'payment_mode', width: 20 }
        ];

        // --- SECTION 1: CASH COLLECTIONS ---
        worksheet.addRow(['💵 CASH COLLECTIONS']).font = { bold: true, size: 12 };
        let cashTotal = 0;
        cashRows.forEach(row => {
            cashTotal += Number(row.amount);
            worksheet.addRow(row);
        });
        
        const cashSubtotalRow = worksheet.addRow({
            customer_name: `CASH TOTAL (${cashRows.length} Recs)`,
            amount: cashTotal
        });
        cashSubtotalRow.font = { bold: true };
        
        // Spacing spacer row
        worksheet.addRow([]);

        // --- SECTION 2: ONLINE COLLECTIONS ---
        worksheet.addRow(['📱 ONLINE COLLECTIONS']).font = { bold: true, size: 12 };
        let onlineTotal = 0;
        onlineRows.forEach(row => {
            onlineTotal += Number(row.amount);
            worksheet.addRow(row);
        });

        const onlineSubtotalRow = worksheet.addRow({
            customer_name: `ONLINE TOTAL (${onlineRows.length} Recs)`,
            amount: onlineTotal
        });
        onlineSubtotalRow.font = { bold: true };

        // Spacing spacer rows
        worksheet.addRow([]);
        worksheet.addRow([]);

        // --- SUMMARY SECTION: GRAND TOTALS ---
        const totalRecordsRow = worksheet.addRow({
            customer_name: 'TOTAL CONSOLIDATED ENTRIES',
            amount: result.rows.length
        });
        totalRecordsRow.font = { italic: true };

        const grandTotalRow = worksheet.addRow({
            customer_name: 'GRAND TOTAL',
            amount: cashTotal + onlineTotal
        });
        grandTotalRow.font = { bold: true, size: 13 };
        grandTotalRow.getCell('amount').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0B2' } // Light Accent highlight background
        };

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

// 3. SEND WHATSAPP (Table Formatted Split Text Engine)
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

        const cashRows = result.rows.filter(row => row.payment_mode === 'Cash');
        const onlineRows = result.rows.filter(row => row.payment_mode !== 'Cash');

        // Helper function to build structured text grid tables
        const generateTableSegment = (title, items) => {
            let total = 0;
            let block = `*${title}*\n`;
            block += "```\n";
            block += "-----------------------------\n";
            block += "Cust Name      | Amt  | Mode \n";
            block += "-----------------------------\n";

            items.forEach((row) => {
                total += Number(row.amount);
                let name = row.customer_name.substring(0, 14).padEnd(14, ' ');
                let amt = String(row.amount).substring(0, 5).padEnd(5, ' ');
                let mode = String(row.payment_mode).substring(0, 4).padEnd(4, ' ');
                block += `${name} | ${amt} | ${mode}\n`;
            });

            block += "-----------------------------\n";
            let label = `TOTAL (${items.length})`.padEnd(14, ' ');
            let totalStr = String(total).padEnd(5, ' ');
            block += `${label} | ${totalStr} | -\n`;
            block += "-----------------------------\n";
            block += "```\n\n";

            return { block, total };
        };

        // Header Metadata Title block
        let finalMessage = `📊 *PIGMY SPLIT COLLECTION REPORT*\n📅 *Date:* ${date}\n\n`;

        // Generate segments dynamically
        const cashSegment = generateTableSegment("💵 CASH SEGMENT", cashRows);
        const onlineSegment = generateTableSegment("📱 ONLINE SEGMENT", onlineRows);

        // Build combined layout message stream
        finalMessage += cashSegment.block;
        finalMessage += onlineSegment.block;

        // Footer Summary Block
        finalMessage += `*=============================*\n`;
        finalMessage += `📝 *Total Consolidated Records:* ${result.rows.length}\n`;
        finalMessage += `💰 *Grand Total Collection:* ₹ ${cashSegment.total + onlineSegment.total}\n`;
        finalMessage += `*=============================*`;

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