const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// 1. ADD NEW CUSTOMER (Mobile Optional)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { customer_name, mobile_number } = req.body;

        if (!customer_name || customer_name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Customer Name Required'
            });
        }

        // OPTIONAL MOBILE CHECK: Agar user mobile number bhejta hai tabhi check hoga
        if (mobile_number && mobile_number.trim() !== '') {
            if (!/^[0-9]{10}$/.test(mobile_number)) {
                return res.status(400).json({
                    success: false,
                    message: 'Enter Valid 10-Digit Mobile Number'
                });
            }
        }

        // DB safe implementation: blank values ko explicitly null convert karenge
        const finalMobileNumber = (mobile_number && mobile_number.trim() !== '') ? mobile_number.trim() : null;

        const result = await pool.query(
            `
            INSERT INTO customers (customer_name, mobile_number, user_id)
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [customer_name.trim(), finalMobileNumber, req.userId]
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

// 2. GET ALL CUSTOMERS
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT *
            FROM customers
            WHERE user_id = $1
            ORDER BY id DESC
            `,
            [req.userId]
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

// 3. UPDATE CUSTOMER (Mobile Optional)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { customer_name, mobile_number } = req.body;

        if (!customer_name || customer_name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Customer Name Required'
            });
        }

        // OPTIONAL MOBILE CHECK
        if (mobile_number && mobile_number.trim() !== '') {
            if (!/^[0-9]{10}$/.test(mobile_number)) {
                return res.status(400).json({
                    success: false,
                    message: 'Enter Valid 10-Digit Mobile Number'
                });
            }
        }

        const finalMobileNumber = (mobile_number && mobile_number.trim() !== '') ? mobile_number.trim() : null;

        await pool.query(
            `
            UPDATE customers
            SET customer_name = $1, mobile_number = $2
            WHERE id = $3 AND user_id = $4
            `,
            [customer_name.trim(), finalMobileNumber, req.params.id, req.userId]
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

// 4. DELETE CUSTOMER
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query(
            `
            DELETE FROM customers
            WHERE id = $1 AND user_id = $2
            `,
            [req.params.id, req.userId]
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