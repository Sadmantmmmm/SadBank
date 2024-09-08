const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const moment = require('moment');
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });
const https = require('https');
const fs = require('fs'); 

const app = express();
app.use(cors());
app.use(express.json());
const clients = new Map();

const options = {
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
};

// Database initialization
async function initDB() {
  const db = await open({
    filename: 'bank.db',
    driver: sqlite3.Database
  });

  // Criação das tabelas se não existirem
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      balance REAL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT,
      amount REAL,
      interest_rate REAL,
      start_date TEXT,
      end_date TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      interest_rate REAL,
      start_date TEXT,
      end_date TEXT,
      monthly_payment REAL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      amount REAL,
      date TEXT,
      datetime TEXT,
      sender_name TEXT,
      FOREIGN KEY (sender_id) REFERENCES users (id),
      FOREIGN KEY (receiver_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS pix_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      pix_key TEXT UNIQUE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  // Função para adicionar coluna se não existir
  async function addColumnIfNotExists(table, columnName, columnType) {
    const columns = await db.all(`PRAGMA table_info(${table});`);
    const columnExists = columns.some(col => col.name === columnName);
    if (!columnExists) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${columnType};`);
      console.log(`Coluna ${columnName} adicionada à tabela ${table}`);
    }
  }

  // Verificar e adicionar colunas faltantes
  await addColumnIfNotExists('transfers', 'date', 'TEXT');
  await addColumnIfNotExists('transfers', 'datetime', 'TEXT');
  await addColumnIfNotExists('transfers', 'sender_name', 'TEXT');

  return db;
}

initDB().then(db => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Error initializing database:', err);
});
app.use(express.static(path.join(__dirname, 'public')));
// Helper functions
async function getUserBalance(db, userId) {
  try {
      const row = await db.get('SELECT balance FROM users WHERE id = ?', userId);
      if (!row) {
          // Exibir notificação sem encerrar o script
          console.log(`Usuário com ID ${userId} não encontrado.`);
          return null; // ou algum valor padrão
      }
      return row.balance;
  } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      // Tratar o erro conforme necessário
      return null; // ou algum valor padrão
  }
}


async function getUserName(db, userId) {
  const row = await db.get('SELECT username FROM users WHERE id = ?', userId);
  if (!row) {
      throw new Error('Usuário não encontrado');
  }
  return row.username;
}

async function updateUserBalance(db, userId, newBalance) {
  await db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
}

function calculateInterest(principal, rate, time) {
  return principal * Math.pow(1 + rate, time) - principal;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const db = await initDB();

  try {
    await db.run('INSERT INTO users (username, password, balance) VALUES (?, ?, ?)', [username, password, 1000]);
    res.status(201).json({ message: 'Usuário registrado com sucesso!' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ message: 'Nome de usuário já existe!' });
    } else {
      res.status(500).json({ message: 'Erro ao registrar usuário.' });
    }
  } finally {
    await db.close();
  }
});

// Endpoint de login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await initDB();

  try {
    const user = await db.get('SELECT id, password FROM users WHERE username = ?', username);
    if (user && user.password === password) {
      res.json({ message: 'Login bem-sucedido!', user_id: user.id });
    } else {
      res.status(401).json({ message: 'Credenciais inválidas!' });
    }
  } finally {
    await db.close();
  }
});

app.post('/invest', async (req, res) => {
  const { user_id, amount, type } = req.body;
  const db = await initDB();

  const interestRates = {
    'Poupança': 0.005,
    'CDI': 0.0052,
    'CDB': 0.0055,
    'Tesouro Direto': 0.006,
    'LCI': 0.0058,
    'LCA': 0.0057
  };

  if (!(type in interestRates)) {
    return res.status(400).json({ message: 'Tipo de investimento inválido!' });
  }

  const interestRate = interestRates[type];

  try {
    const currentBalance = await getUserBalance(db, user_id);
    if (currentBalance >= amount) {
      const newBalance = currentBalance - amount;
      await updateUserBalance(db, user_id, newBalance);

      const startDate = moment().format('YYYY-MM-DD');
      const endDate = moment().add(1, 'year').format('YYYY-MM-DD');

      await db.run(
        'INSERT INTO investments (user_id, type, amount, interest_rate, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, type, amount, interestRate, startDate, endDate]
      );

      res.json({ message: 'Investimento realizado com sucesso!', new_balance: newBalance });
    } else {
      res.status(400).json({ message: 'Saldo insuficiente!' });
    }
  } finally {
    await db.close();
  }
});

// Transfer Route
app.post('/transfer', async (req, res) => {
    const { sender_id, receiver_id, amount } = req.body;
    const db = await initDB();
  
    try {
      const senderBalance = await getUserBalance(db, sender_id);
      if (senderBalance >= amount) {
        const receiverBalance = await getUserBalance(db, receiver_id);
  
        await updateUserBalance(db, sender_id, senderBalance - amount);
        await updateUserBalance(db, receiver_id, receiverBalance + amount);
  
        const date = moment().format('YYYY-MM-DD');
  
        await db.run(
          'INSERT INTO transfers (sender_id, receiver_id, amount, date) VALUES (?, ?, ?, ?)',
          [sender_id, receiver_id, amount, date]
        ); 
        res.json({ message: 'Transferência realizada com sucesso!' });
      } else {
        res.status(400).json({ message: 'Saldo insuficiente!' });
      }
    } finally {
      await db.close();
    }
  });

  async function addNotification(db, userId, message) {
    await db.run('INSERT INTO notifications (user_id, message, read) VALUES (?, ?, 0)', [userId, message]);
  }
// Updated Pix transfer route
app.post('/pix/transfer', async (req, res) => {
  const { pix_key, amount, user_id } = req.body;
  const db = await initDB();

  try {
    const receiver = await db.get('SELECT user_id FROM pix_keys WHERE pix_key = ?', pix_key);
    if (!receiver) {
      return res.status(404).json({ message: 'Chave Pix não encontrada!' });
    }

    const senderBalance = await getUserBalance(db, user_id);
    const senderName = await getUserName(db, user_id);
    const receiverName = await getUserName(db, receiver.user_id); // Recuperar o nome do destinatário
    if (senderBalance >= amount) {
      const receiverBalance = await getUserBalance(db, receiver.user_id);
      await updateUserBalance(db, user_id, senderBalance - amount);
      await updateUserBalance(db, receiver.user_id, receiverBalance + amount);

      const datetime = moment().format('YYYY-MM-DD HH:mm:ss');

      await db.run(
        'INSERT INTO transfers (sender_id, receiver_id, amount, date, datetime, sender_name) VALUES (?, ?, ?, ?, ?, ?)',
        [user_id, receiver.user_id, amount, moment().format('YYYY-MM-DD'), datetime, senderName]
      );

      // Add notification for the receiver
      const notificationMessage = `Você recebeu R$${amount} de ${senderName} via Pix.`;
      await addNotification(db, receiver.user_id, notificationMessage);

      // Resposta com o nome correto do destinatário
      res.json({ message: `Você Enviou R$${amount} para ${receiverName} via Pix!` });
    } else {
      res.status(400).json({ message: 'Saldo insuficiente!' });
    }
  } finally {
    await db.close();
  }
});

// Pix Register Route
app.post('/pix/register', async (req, res) => {
    const { user_id, pix_key } = req.body;
    const db = await initDB();

    try {
        await db.run('INSERT INTO pix_keys (user_id, pix_key) VALUES (?, ?)', [user_id, pix_key]);
        res.json({ message: 'Chave Pix registrada com sucesso!' });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            res.status(400).json({ message: 'Chave Pix já existe!' });
        } else {
            res.status(500).json({ message: 'Erro ao registrar chave Pix.' });
        }
    } finally {
        await db.close();
    }
});
// Modifique a rota de busca de notificações
app.get('/notifications/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const db = await initDB();

  try {
    const notifications = await db.all('SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC', user_id);
    res.json(notifications);
  } finally {
    await db.close();
  }
});
// Adicione uma nova rota para marcar notificações como lidas
app.post('/mark-notifications-read/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const db = await initDB();

  try {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0', user_id);
    res.json({ success: true, message: 'Notificações marcadas como lidas' });
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error);
    res.status(500).json({ success: false, message: 'Erro ao marcar notificações como lidas' });
  } finally {
    await db.close();
  }
});
// New route to mark notifications as read
app.post('/notifications/read', async (req, res) => {
  const { notification_ids } = req.body;
  const db = await initDB();

  try {
    await db.run('UPDATE notifications SET read = 1 WHERE id IN (' + notification_ids.join(',') + ')');
    res.json({ message: 'Notifications marked as read' });
  } finally {
    await db.close();
  }
});

app.get('/pix/keys/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const db = await initDB();

  try {
      const keys = await db.all('SELECT pix_key FROM pix_keys WHERE user_id = ?', user_id);
      res.json(keys);
  } finally {
      await db.close();
  }
});

// Loan Simulation Route
app.post('/loan/simulate', (req, res) => {
    const { principal, rate, time } = req.body;
    const interest = calculateInterest(principal, rate, time);
    res.json({ interest });
});

// Get User Info Route
app.get('/user/info/:id', async (req, res) => {
    const db = await initDB();

    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', req.params.id);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'Usuário não encontrado!' });
        }
    } finally {
        await db.close();
    }
});

// Rota para buscar histórico de transações enviadas e recebidas
app.get('/history/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const db = await initDB();

  try {
    // Buscando transações onde o usuário é o remetente ou o destinatário
    const transactions = await db.all(
      `SELECT 
        t.id,
        t.amount,
        t.date,
        t.datetime,
        t.sender_id,
        t.receiver_id,
        t.sender_name,
        u1.username as sender_name,
        u2.username as receiver_name
      FROM transfers t
      LEFT JOIN users u1 ON t.sender_id = u1.id
      LEFT JOIN users u2 ON t.receiver_id = u2.id
      WHERE t.sender_id = ? OR t.receiver_id = ?
      ORDER BY t.datetime DESC`, [user_id, user_id]
    );

    res.json(transactions);
  } catch (error) {
    console.error('Erro ao buscar histórico de transações:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico de transações.' });
  } finally {
    await db.close();
  }
});


// Calculate Interest Route
app.post('/calculate_interest', (req, res) => {
    const { principal, rate, time } = req.body;
    const interest = calculateInterest(principal, rate, time);
    res.json({ interest });
});

// Rota para obter o saldo do usuário
app.get('/api/saldo/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const db = await initDB();

  try {
    const balance = await getUserBalance(db, user_id);
    if (balance !== null) {
      res.json({ saldo: balance });
    } else {
      res.status(404).json({ message: 'Saldo não encontrado!' });
    }
  } catch (error) {
    console.error('Erro ao obter saldo:', error);
    res.status(500).json({ message: 'Erro ao obter saldo.' });
  } finally {
    await db.close();
  }
});


// WebSocket configuration
wss.on('connection', (ws, request) => {
  const userId = request.url.split('/').pop(); // Assume userId is part of the URL
  clients.set(userId, ws);

  ws.on('close', () => {
    clients.delete(userId);
  });
});

// Criar servidor HTTPS em vez de HTTP
const PORT = process.env.PORT || 3000;
const server = https.createServer(options, app).listen(PORT, () => {
  console.log(`Server running on https://localhost:${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});