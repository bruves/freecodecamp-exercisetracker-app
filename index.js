const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

//Define Exercise Schema
const exerciseSchema = new mongoose.Schema({
  username: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

//Define User
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});
const User = mongoose.model('User', userSchema);

//API Routes
app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

//Create a new user
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = new User({ username });
  user.save()
    .then(savedUser => res.json({ username: savedUser.username, _id: savedUser._id }))
    .catch(err => res.status(500).json({ error: 'Error saving user' }));
});

//Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { username: 1, _id: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

//Add an exercise for a user
app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;

  if (!description || !duration) {
    return res.status(400).json({ error: 'Description and duration are required' });
  }
  const exerciseDate = date ? new Date(date) : new Date();
  if (isNaN(exerciseDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const exercise = new Exercise({
      username: user.username,
      description,
      duration: parseInt(duration),
      date: exerciseDate
    });
    await exercise.save();


    res.json({
      username: user.username,
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString(),
      _id: user._id
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

//Get all logs for a user with optional query parameters
app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(_id);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Build query
    let query = { username: user.username };
    if (from || to) {
      query.date = {};
      if (from) {
        const fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({ error: 'Invalid from date format' });
        }
        query.date.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({ error: 'Invalid to date format' });
        }
        query.date.$lte = toDate;
      }
    }

    let exercisesQuery = Exercise.find(query).select('-__v -_id');
    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 0) {
        return res.status(400).json({ error: 'Invalid limit' });
      }
      exercisesQuery = exercisesQuery.limit(limitNum);
    }

    const exercises = await exercisesQuery.exec();

    res.json({
      _id: user._id,
      username: user.username,
      count: exercises.length,
      log: exercises.map(entry => ({
        description: entry.description,
        duration: entry.duration,
        date: new Date(entry.date).toDateString()
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
