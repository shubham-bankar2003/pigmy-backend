const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');
const authMiddleware = require('../middleware/auth');

// Helper function to group database results by customer name
const groupDataByCustomer = (rows) => {
    return Object.values(
        rows.reduce((acc, row) => {
            const name = row.customer_name;
            const amount = Number(row.amount);
            const isCash = row.payment_mode === 'Cash';

            if (!acc[name]) {
                acc[name] = {
                    customer_name: name,
                    cashAmount: 0,
                    onlineAmount: 0,
                    totalAmount: 0
                };
            }

            if (isCash) {
                acc[name].cashAmount += amount;
            } else {
                acc[name].onlineAmount += amount;
            }
            acc[name].totalAmount += amount;

            return acc;
        }, {})
    );
};

// 1. GET REPORT DATA (Unchanged)
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

// 2. EXPORT TO EXCEL (Unified Grouped Layout)
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

        // Group data into single rows per customer
        const groupedRows = groupDataByCustomer(result.rows);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pigmy Consolidated Report');

        // Layout matching your unified UI changes
        worksheet.columns = [
            { header: 'Customer Name', key: 'customer_name', width: 30 },
            { header: 'Cash Payment', key: 'cashAmount', width: 18 },
            { header: 'Online Payment', key: 'onlineAmount', width: 18 },
            { header: 'Total Amount', key: 'totalAmount', width: 18 }
        ];

        // Format the header row visually
        worksheet.getRow(1).font = { bold: true };

        let grandCash = 0;
        let grandOnline = 0;
        let grandTotal = 0;

        // Add grouped rows
        groupedRows.forEach(row => {
            grandCash += row.cashAmount;
            grandOnline += row.onlineAmount;
            grandTotal += row.totalAmount;

            worksheet.addRow({
                customer_name: row.customer_name,
                cashAmount: row.cashAmount > 0 ? row.cashAmount : '-',
                onlineAmount: row.onlineAmount > 0 ? row.onlineAmount : '-',
                totalAmount: row.totalAmount
            });
        });

        // Spacing spacer row
        worksheet.addRow([]);

        // Footer Total Rows
        const summaryRow = worksheet.addRow({
            customer_name: `Summary Totals (${groupedRows.length} Customers)`,
            cashAmount: grandCash,
            onlineAmount: grandOnline,
            totalAmount: grandTotal
        });

        summaryRow.font = { bold: true, size: 12 };
        summaryRow.getCell('totalAmount').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE0B2' } // Light Accent highlight background
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Pigmy_Consolidated_Report_${date}.xlsx`);

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

// 3. SEND WHATSAPP (Unified Text Layout)
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

        // Group data to clean up layout spaces
        const groupedRows = groupDataByCustomer(result.rows);

        let grandCash = 0;
        let grandOnline = 0;
        let grandTotal = 0;

        // Clean, structured text matrix layout that uses explicit string character padding inside code blocks.
        // This ensures columns align perfectly on mobile WhatsApp screens without text wrapping distortion.
        let textBlock = `📊 *CONSOLIDATED PIGMY REPORT*\n`;
        textBlock += `📅 *Date:* ${date}\n\n`;
        textBlock += "```\n";
        textBlock += "---------------------------------\n";
        textBlock += "Cust Name      | Cash  | Online \n";
        textBlock += "---------------------------------\n";

        groupedRows.forEach((row) => {
            grandCash += row.cashAmount;
            grandOnline += row.onlineAmount;
            grandTotal += row.totalAmount;

            let name = row.customer_name.substring(0, 14).padEnd(14, ' ');
            let cash = row.cashAmount > 0 ? String(row.cashAmount).substring(0, 5) : '-';
            let online = row.onlineAmount > 0 ? String(row.onlineAmount).substring(0, 5) : '-';
            
            cash = cash.padEnd(5, ' ');
            online = online.padEnd(6, ' ');

            textBlock += `${name} | ${cash} | ${online}\n`;
        });

        textBlock += "---------------------------------\n";
        let summaryLabel = "TOTALS".padEnd(14, ' ');
        let totalCashStr = String(grandCash).substring(0, 5).padEnd(5, ' ');
        let totalOnlineStr = String(grandOnline).substring(0, 5).padEnd(6, ' ');
        
        textBlock += `${summaryLabel} | ${totalCashStr} | ${totalOnlineStr}\n`;
        textBlock += "---------------------------------\n";
        textBlock += "```\n\n";

        textBlock += `💰 *GRAND TOTAL:* ₹ ${grandTotal}\n`;
        textBlock += `👥 *Total Customers:* ${groupedRows.length}\n`;
        textBlock += `---------------------------------\n`;
        textBlock += `_Generated automatically via Pigmy System._`;

        res.json({
            success: true,
            whatsappNumber: mobile,
            message: textBlock
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