//imports
const express = require('express')
const cors = require('cors')
const { MongoClient } = require('mongodb')
require('dotenv').config()
const admin = require('firebase-admin')

const app = express()
const port = process.env.PORT || 5000

// middlewares
app.use(cors())
app.use(express.json())

// authorize admin

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

// connect to mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lmhyi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

// verify token
async function verifyToken(req, res, next) {
  if (req?.headers?.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1]

    try {
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    } catch {}
  }
  next()
}

async function run() {
  try {
    await client.connect()
    const database = client.db('scrambled-cubeshop')
    const usersCollection = database.collection('users')
    // post an user
    app.post('/users', async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.json(result)
    })
    // set role
    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body
      const requester = req.decodedEmail
      const requesterRole = await usersCollection.findOne({
        email: requester,
      })
      if (requesterRole.role === 'admin') {
        const filter = { email: user.email }
        const updateDoc = { $set: { role: 'admin' } }
        const result = await usersCollection.updateOne(filter, updateDoc)
        res.json(result)
      } else {
        res.status(403).send('Access denied')
      }
    })
    // get admin users
    app.get('/users/:email', async (req, res) => {
      const email = req?.params?.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let isAdmin = false
      if (user?.role === 'admin') {
        isAdmin = true
      }
      res.json({ admin: isAdmin })
    })
  } finally {
    // await client.close()
  }
}
run().catch(console.dir)

// testing server
app.get('/', (req, res) => {
  res.send('Hello World!')
})

// running server
app.listen(port, () => {
  console.log(`server listening at port : ${port}`)
})