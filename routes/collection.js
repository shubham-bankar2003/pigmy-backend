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
            customer_id,
            amount,
            payment_mode
        } = req.body;

        if (!customer_id) {

            return res.status(400).json({
                success: false,
                message: 'Customer Required'
            });

        }

        if (
            !amount ||
            Number(amount) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Amount Must Be Greater Than Zero'
            });

        }

        if (!payment_mode) {

            return res.status(400).json({
                success: false,
                message:
                    'Payment Mode Required'
            });

        }

        const result = await pool.query(
            `
            INSERT INTO pigmy_collections
            (
                customer_id,
                amount,
                payment_mode,
                user_id
            )
            VALUES
            (
                $1,$2,$3,$4
            )
            RETURNING *
            `,
            [
                customer_id,
                amount,
                payment_mode,
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
            SELECT
                pc.id,
                pc.customer_id,
                pc.amount,
                pc.payment_mode,
                pc.collection_date,
                c.customer_name
            FROM pigmy_collections pc
            INNER JOIN customers c
                ON pc.customer_id = c.id
            WHERE
                pc.user_id = $1
            ORDER BY
                pc.id DESC
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
            customer_id,
            amount,
            payment_mode
        } = req.body;

        await pool.query(
            `
            UPDATE pigmy_collections
            SET
                customer_id = $1,
                amount = $2,
                payment_mode = $3
            WHERE
                id = $4
                AND user_id = $5
            `,
            [
                customer_id,
                amount,
                payment_mode,
                req.params.id,
                req.userId
            ]
        );

        res.json({
            success: true,
            message:
                'Collection Updated'
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
            DELETE FROM pigmy_collections
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
                'Collection Deleted'
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
