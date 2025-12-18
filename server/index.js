const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json()); // Pour parser le JSON body

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Matcha API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});