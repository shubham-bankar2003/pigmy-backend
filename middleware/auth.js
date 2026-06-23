const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {

    try {

        const authHeader =
            req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message: 'Token Required'
            });

        }

        const token =
            authHeader.split(' ')[1];

        if (!token) {

            return res.status(401).json({
                success: false,
                message: 'Invalid Token'
            });

        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.userId = decoded.userId;

        req.mobileNumber =
            decoded.mobileNumber;

        next();

    }
    catch (error) {

        return res.status(401).json({
            success: false,
            message: 'Unauthorized'
        });

    }

};

module.exports = authMiddleware;