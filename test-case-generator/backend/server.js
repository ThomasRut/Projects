const express = require('express');
const cors = require('cors');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const generateRoutes = require('./routes/generate');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/upload', uploadRoutes);
app.use('/api/generate', generateRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});