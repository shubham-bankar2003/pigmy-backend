const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

router.post('/send-otp', async (req, res) => {

    try {

        const { mobile_number } = req.body;

        if (!mobile_number) {

            return res.status(400).json({
                success: false,
                message: 'Mobile Number Required'
            });

        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const otpExpiry = new Date(
            Date.now() + 5 * 60 * 1000
        );

        const userResult = await pool.query(
            `
            SELECT *
            FROM users
            WHERE mobile_number = $1
            `,
            [mobile_number]
        );

        if (userResult.rows.length === 0) {

            await pool.query(
                `
                INSERT INTO users
                (
                    mobile_number,
                    otp,
                    otp_expiry
                )
                VALUES
                (
                    $1,$2,$3
                )
                `,
                [
                    mobile_number,
                    otp,
                    otpExpiry
                ]
            );

        } else {

            await pool.query(
                `
                UPDATE users
                SET
                    otp = $1,
                    otp_expiry = $2
                WHERE mobile_number = $3
                `,
                [
                    otp,
                    otpExpiry,
                    mobile_number
                ]
            );

        }

        console.log(
            `OTP For ${mobile_number} : ${otp}`
        );

        res.json({
            success: true,
            message: 'OTP Sent',
            otp
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

router.post('/verify-otp', async (req, res) => {

    try {

        const {
            mobile_number,
            otp
        } = req.body;

        const result = await pool.query(
            `
            SELECT *
            FROM users
            WHERE mobile_number = $1
            `,
            [mobile_number]
        );

        if (result.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: 'User Not Found'
            });

        }

        const user = result.rows[0];

        if (user.otp !== otp) {

            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });

        }

        if (
            new Date(user.otp_expiry) <
            new Date()
        ) {

            return res.status(400).json({
                success: false,
                message: 'OTP Expired'
            });

        }

        const token = jwt.sign(
            {
                userId: user.id,
                mobileNumber:
                    user.mobile_number
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        res.json({
            success: true,
            token,
            userId: user.id
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