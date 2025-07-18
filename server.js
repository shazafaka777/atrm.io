require('dotenv').config({ debug: true });
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

// Debugging
console.log('MONGO_URI:', process.env.MONGO_URI);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://djabrailov:136990366@cluster0.tpv0c.mongodb.net/employee-management?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// ... остальной код сервера ...

// Модель сотрудника
const employeeSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  fullName: { type: String, required: true },
  position: { type: String, required: true },
  support: Boolean,
  forum: Boolean,
  log: Boolean,
  bk: String,
  discord: String,
  presence: { type: String, enum: ['present', 'absent', 'pending'], required: true },
  role: { type: String, enum: ['employee', 'moderator', 'admin'], required: true },
  notes: String
});

const Employee = mongoose.model('Employee', employeeSchema);

// Роуты для сотрудников
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.find();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  const employee = new Employee(req.body);
  try {
    const newEmployee = await employee.save();
    res.status(201).json(newEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Аутентификация
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // В реальном приложении нужно использовать хеширование паролей!
  const users = [
    { username: 'admin', password: 'admin123', name: 'Администратор', role: 'admin', avatar: 'A' },
    { username: 'moderator', password: 'moder123', name: 'Модератор', role: 'moderator', avatar: 'M' },
    { username: 'employee', password: 'empl123', name: 'Сотрудник', role: 'employee', avatar: 'E' }
  ];

  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});// ... предыдущий код сервера ...

// Роут для получения данных о присутствии
app.get('/api/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    const query = date ? { date: new Date(date) } : {};
    
    const attendance = await Employee.find(query)
      .sort({ date: -1 })
      .limit(30); // последние 30 записей
    
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Роут для получения статистики
app.get('/api/statistics', async (req, res) => {
  try {
    const { period } = req.query; // day, week, month
    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    const stats = await Employee.aggregate([
      {
        $match: {
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: "$presence",
          count: { $sum: 1 },
          employees: { $addToSet: "$fullName" }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
          employees: 1
        }
      }
    ]);

    // Преобразуем данные для удобства клиента
    const result = {
      total: stats.reduce((sum, item) => sum + item.count, 0),
      byStatus: {},
      employees: {}
    };

    stats.forEach(item => {
      result.byStatus[item.status] = item.count;
      result.employees[item.status] = item.employees;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});