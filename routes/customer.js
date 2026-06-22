const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {

try {

    const { customer_name, mobile_number } = req.body;

    if (!customer_name || customer_name.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Customer name is required'
        });
    }

    if (!/^[0-9]{10}$/.test(mobile_number)) {
        return res.status(400).json({
            success: false,
            message: 'Enter valid 10 digit mobile number'
        });
    }

    const result = await pool.query(
        `INSERT INTO customers
        (customer_name,mobile_number)
        VALUES($1,$2)
        RETURNING *`,
        [customer_name, mobile_number]
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
        `SELECT *
         FROM customers
         ORDER BY id DESC`
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

    const { customer_name, mobile_number } = req.body;

    await pool.query(
        `UPDATE customers
         SET customer_name=$1,
             mobile_number=$2
         WHERE id=$3`,
        [
            customer_name,
            mobile_number,
            req.params.id
        ]
    );

    res.json({
        success: true,
        message: 'Customer Updated'
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
        `DELETE FROM customers
         WHERE id=$1`,
        [req.params.id]
    );

    res.json({
        success: true,
        message: 'Customer Deleted'
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
