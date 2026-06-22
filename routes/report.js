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

}
catch (error) {

    console.log(error);

    res.status(500).json({
        success: false,
        message: error.message
    });

}

});
