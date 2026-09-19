import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
// Import the client exactly from where Prisma just generated it
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Create a connection pool using standard Node.js process.env
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Wrap the pool in Prisma's adapter
const adapter = new PrismaPg(pool);

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });
const app = express();
const httpServer = createServer(app);

// Set up WebSockets for live TV/App updates
const io = new Server(httpServer, {
  cors: { origin: "*" } // Allow your mobile and web apps to connect
});

app.use(cors());
app.use(express.json());

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running perfectly!' });
});

// 2. Test Endpoint to Create a Business
app.post('/api/businesses', async (req, res) => {
  try {
    const business = await prisma.business.create({
      data: { name: req.body.name || "Test Clinic" }
    });
    res.json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create business" });
  }
});

// Handle WebSocket connections and Subscriptions
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // The Next.js dashboard will send this when it loads
  socket.on('join_queue', (queueId) => {
    socket.join(`queue_${queueId}`);
    console.log(`Client ${socket.id} joined queue_${queueId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is live and listening on http://localhost:${PORT}`);
});

// 3. Create a Queue for a Business
app.post('/api/queues', async (req, res) => {
  try {
    const queue = await prisma.queue.create({
      data: {
        businessId: req.body.businessId,
        name: req.body.name || "Main Line"
      }
    });
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: "Failed to create queue" });
  }
});

// 4. Generate a Token and Broadcast via WebSockets
app.post('/api/tokens', async (req, res) => {
  try {
    const { queueId, phone } = req.body;

    // Find or create the user based on their phone number
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { phone } });
    }

    // Determine the next token number for this queue
    const lastToken = await prisma.token.findFirst({
      where: { queueId },
      orderBy: { tokenNumber: 'desc' }
    });
    const nextNumber = lastToken ? lastToken.tokenNumber + 1 : 1;

    // Issue the token
    const newToken = await prisma.token.create({
      data: {
        queueId,
        userId: user.id,
        tokenNumber: nextNumber,
        status: "PENDING"
      }
    });

    // The Magic: Broadcast the update to anyone listening to this specific queue
    io.to(`queue_${queueId}`).emit('token_added', newToken);

    res.json(newToken);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// 5. Get Current State (So the UI isn't blank on refresh)
app.get('/api/queues/:queueId/state', async (req, res) => {
  const { queueId } = req.params;
  const activeToken = await prisma.token.findFirst({ where: { queueId, status: 'ACTIVE' } });
  const pendingTokens = await prisma.token.findMany({ where: { queueId, status: 'PENDING' }, orderBy: { tokenNumber: 'asc' } });
  res.json({ activeToken, pendingTokens });
});

// 6. Next Patient (Marks active as COMPLETED, activates next in line)
app.post('/api/queues/next', async (req, res) => {
  const { queueId } = req.body;
  
  // 1. Mark currently ACTIVE token as COMPLETED
  await prisma.token.updateMany({
    where: { queueId, status: 'ACTIVE' },
    data: { status: 'COMPLETED' }
  });

  // 2. Find the oldest PENDING token
  const nextToken = await prisma.token.findFirst({
    where: { queueId, status: 'PENDING' },
    orderBy: { tokenNumber: 'asc' }
  });

  // 3. Mark it as ACTIVE
  if (nextToken) {
    await prisma.token.update({
      where: { id: nextToken.id },
      data: { status: 'ACTIVE' }
    });
  }

  // 4. Fetch fresh state and broadcast
  const pendingTokens = await prisma.token.findMany({ where: { queueId, status: 'PENDING' }, orderBy: { tokenNumber: 'asc' } });
  const newState = { activeToken: nextToken, pendingTokens };
  
  io.to(`queue_${queueId}`).emit('queue_updated', newState);
  res.json(newState);
});

// 7. Skip a Token (Removes from line without activating)
app.post('/api/tokens/skip', async (req, res) => {
  const { tokenId, queueId } = req.body;
  await prisma.token.update({ where: { id: tokenId }, data: { status: 'SKIPPED' } });
  
  const activeToken = await prisma.token.findFirst({ where: { queueId, status: 'ACTIVE' } });
  const pendingTokens = await prisma.token.findMany({ where: { queueId, status: 'PENDING' }, orderBy: { tokenNumber: 'asc' } });
  
  io.to(`queue_${queueId}`).emit('queue_updated', { activeToken, pendingTokens });
  res.json({ success: true });
});