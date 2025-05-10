const express = require('express');
const app = express();
const port = 3000;

// Import routers
const userRouter = require('./routes/user');
const sessionRouter = require('./routes/session');
const messageRouter = require('./routes/message.js'); // Import message router
// Middleware to parse JSON
app.use(express.json());

// Use routers
app.use('/user', userRouter);
app.use('/session', sessionRouter);
app.use('/message', messageRouter);

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
