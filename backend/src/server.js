const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const tripRoutes = require('./routes/tripRoutes');
const delegateRoutes = require('./routes/delegateRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const initSockets = require('./sockets');

const app = express();
const server = http.createServer(app);

// إعداد Socket.io مع CORS مسموح بيه فقط لدومين الفرونت إند
const io = new Server(server, {
  cors: { origin: env.corsOrigin, methods: ['GET', 'POST'] },
});
initSockets(io);

// إتاحة io لأي controller عن طريق req.app.get('io')
app.set('io', io);

// ---------- Middlewares عامة ----------
app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// حماية بسيطة من الطلبات الكثيرة (Rate limiting) خصوصًا على مسار الموقع
const locationLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 }); // 30 طلب/دقيقة لكل IP
app.use('/api/location', locationLimiter);

// ---------- Routes ----------
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/delegates', delegateRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

server.listen(env.port, () => {
  console.log(`[SERVER] MoneyMeters Tracker API شغال على المنفذ ${env.port} (${env.nodeEnv})`);
});

// التقاط أي أخطاء غير متوقعة عشان السيرفر ميقعش فجأة
process.on('unhandledRejection', (err) => console.error('[UNHANDLED REJECTION]', err));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]', err));
