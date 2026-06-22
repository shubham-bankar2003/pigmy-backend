const express = require('express');
const router = express.Router();
const pool = require('../db');
const ExcelJS = require('exceljs');

router.get('/date/:date', async (req, res) => {

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
        INNER JOIN customers c
            ON p.customer_id = c.id
        WHERE CAST(p.collection_date AS DATE) = $1
        ORDER BY c.customer_name
        `,
        [date]
    );

    res.json({
        success: true,
        data: result.rows
    });

} catch (error) {

    res.status(500).json({
        success: false,
        message: error.message
    });

}

});

router.get('/export/:date', async (req, res) => {

try {

    const date = req.params.date;

    const result = await pool.query(
        `
        SELECT
            c.customer_name,
            p.amount,
            p.payment_mode
        FROM pigmy_collections p
        INNER JOIN customers c
            ON p.customer_id = c.id
        WHERE CAST(p.collection_date AS DATE) = $1
        ORDER BY c.customer_name
        `,
        [date]
    );

    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet('Pigmy Report');

    worksheet.columns = [
        {
            header: 'Customer Name',
            key: 'customer_name',
            width: 30
        },
        {
            header: 'Amount',
            key: 'amount',
            width: 15
        },
        {
            header: 'Payment Mode',
            key: 'payment_mode',
            width: 20
        }
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

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
        'Content-Disposition',
        `attachment; filename=Pigmy_Report_${date}.xlsx`
    );

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

router.post('/send-whatsapp', async (req, res) => {

try {

    const { date, mobile } = req.body;

    if (!date) {

        return res.status(400).json({
            success: false,
            message: 'Please Select Date'
        });

    }

    if (!mobile) {

        return res.status(400).json({
            success: false,
            message: 'Please Enter WhatsApp Number'
        });

    }

    const result = await pool.query(
        `
        SELECT
            c.customer_name,
            p.amount,
            p.payment_mode
        FROM pigmy_collections p
        INNER JOIN customers c
            ON p.customer_id = c.id
        WHERE CAST(p.collection_date AS DATE) = $1
        ORDER BY c.customer_name
        `,
        [date]
    );

    let message =
        `Pigmy Collection Report (${date})\n\n`;

    let total = 0;

    result.rows.forEach((row, index) => {

        total += Number(row.amount);

        message +=
            `${index + 1}. ${row.customer_name} - ${row.amount} (${row.payment_mode})\n`;

    });

    message += `\nTotal Collection : ${total}`;

    res.json({
        success: true,
        whatsappNumber: mobile,
        message: message
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
