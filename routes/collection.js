const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {

try {

    const {
        customer_id,
        amount,
        payment_mode
    } = req.body;

    if (!customer_id) {
        return res.status(400).json({
            success: false,
            message: 'Customer is required'
        });
    }

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Amount must be greater than zero'
        });
    }

    if (!payment_mode) {
        return res.status(400).json({
            success: false,
            message: 'Payment mode required'
        });
    }

    const result = await pool.query(
        `INSERT INTO pigmy_collections
        (
            customer_id,
            amount,
            payment_mode
        )
        VALUES($1,$2,$3)
        RETURNING *`,
        [
            customer_id,
            amount,
            payment_mode
        ]
    );

    res.json({
        success: true,
        data: result.rows[0]
    });

} catch (error) {

    console.log(error);

    res.status(500).json({
        success: false,
        message: error.message
    });

}

});

router.get('/', async (req, res) => {

try {

    const result = await pool.query(
        `SELECT
            pc.id,
            pc.customer_id,
            pc.amount,
            pc.payment_mode,
            pc.collection_date,
            c.customer_name
        FROM pigmy_collections pc
        INNER JOIN customers c
            ON pc.customer_id = c.id
        ORDER BY pc.id DESC`
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

router.put('/:id', async (req, res) => {

try {

    const {
        customer_id,
        amount,
        payment_mode
    } = req.body;

    await pool.query(
        `UPDATE pigmy_collections
         SET
            customer_id = $1,
            amount = $2,
            payment_mode = $3
         WHERE id = $4`,
        [
            customer_id,
            amount,
            payment_mode,
            req.params.id
        ]
    );

    res.json({
        success: true,
        message: 'Collection Updated'
    });

} catch (error) {

    console.log(error);

    res.status(500).json({
        success: false,
        message: error.message
    });

}

});

router.delete('/:id', async (req, res) => {

try {

    await pool.query(
        `DELETE FROM pigmy_collections
         WHERE id = $1`,
        [req.params.id]
    );

    res.json({
        success: true,
        message: 'Collection Deleted'
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
