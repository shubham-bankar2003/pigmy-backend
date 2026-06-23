const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.post(
'/',
authMiddleware,
async (req, res) => {

    try {

        const {
            customer_name,
            mobile_number
        } = req.body;

        if (
            !customer_name ||
            customer_name.trim() === ''
        ) {

            return res.status(400).json({
                success: false,
                message: 'Customer Name Required'
            });

        }

        if (
            !/^[0-9]{10}$/.test(
                mobile_number
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Enter Valid Mobile Number'
            });

        }

        const result = await pool.query(
            `
            INSERT INTO customers
            (
                customer_name,
                mobile_number,
                user_id
            )
            VALUES
            (
                $1,$2,$3
            )
            RETURNING *
            `,
            [
                customer_name,
                mobile_number,
                req.userId
            ]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

);

router.get(
'/',
authMiddleware,
async (req, res) => {

    try {

        const result = await pool.query(
            `
            SELECT *
            FROM customers
            WHERE user_id = $1
            ORDER BY id DESC
            `,
            [
                req.userId
            ]
        );

        res.json({
            success: true,
            data: result.rows
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

);

router.put(
'/:id',
authMiddleware,
async (req, res) => {

    try {

        const {
            customer_name,
            mobile_number
        } = req.body;

        await pool.query(
            `
            UPDATE customers
            SET
                customer_name = $1,
                mobile_number = $2
            WHERE
                id = $3
                AND user_id = $4
            `,
            [
                customer_name,
                mobile_number,
                req.params.id,
                req.userId
            ]
        );

        res.json({
            success: true,
            message:
                'Customer Updated'
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

);

router.delete(
'/:id',
authMiddleware,
async (req, res) => {

    try {

        await pool.query(
            `
            DELETE FROM customers
            WHERE
                id = $1
                AND user_id = $2
            `,
            [
                req.params.id,
                req.userId
            ]
        );

        res.json({
            success: true,
            message:
                'Customer Deleted'
        });

    }
    catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

}

);

module.exports = router;
