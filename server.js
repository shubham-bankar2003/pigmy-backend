require('dotenv').config();

const express = require('express');
const cors = require('cors');

const pool = require('./db');

const customerRoutes = require('./routes/customer');
const collectionRoutes = require('./routes/collection');
const reportRoutes = require('./routes/report');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use('/api/customer', customerRoutes);

app.use('/api/collection', collectionRoutes);

app.use('/api/report', reportRoutes);

app.get('/', (req, res) => {

res.send('Pigmy Backend Running');

});

app.get('/test-db', async (req, res) => {

try {

    const result = await pool.query(
        'SELECT NOW()'
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

});

const PORT =
process.env.PORT || 5000;

app.listen(PORT, () => {

console.log(
    `Server Running On Port ${PORT}`
);

});
