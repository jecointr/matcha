const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Matcha Backend API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});