const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 9988;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_WEB_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASS}@cluster0.ugrpd0k.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
});

async function run() {
    try {
        // all collections
        const userCollection = client.db('userCollections').collection('users');
        const classCollection = client.db('classCollection').collection('classes');
        const selectedClasses = client.db('selectClasses').collection('classes');
        const paymentCollection = client.db('coursePayment').collection('payments');
        const feedbackCollection = client.db('feedbackMessage').collection('feedback');
        const newSelectClass = client.db('newSelection').collection('selected')

        // classes related api : this is popular class api for home
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        });

        // manage student dashboard
        // find my selected class
        app.get('/my-selected-class/:email', async (req, res) => {
            const email = req.params.email;
            const query = { myEmail: email };
            const result = await newSelectClass.find(query).toArray();
            res.send(result);
        });
        app.post('/new-selected-class', async (req, res) => {
            const data = req.body;
            const query = { _id: new ObjectId(data._id) };
            const existingData = await newSelectClass.findOne(query);
            if (existingData) {
                return res.status(400).json({ message: 'Data already exists' });
            }
            const result = await newSelectClass.insertOne(data);
            res.send(result);
        });
        // this is selected code update api
        app.patch('/select-course/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const course = await classCollection.findOne(query);
            const selectCourse = course.seate - 1;
            const update = {
                $set: {
                    selected: true,
                    seate: selectCourse
                }
            };
            const result = await classCollection.updateOne(query, update);
            res.send(result)
        });
        app.delete('/selected-class-delete/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await newSelectClass.deleteOne(query);
            res.send(result)
        });
        // jwt web token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_WEB_TOKEN, { expiresIn: '1h' });
            res.send(token)
        })
        // users api
        app.get('/users', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        });
        // check admin a user
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const filter = { email: email }
            const user = await userCollection.findOne(filter);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        });
        app.get('/instructor-user', async (req, res) => {
            const query = { role: 'instructor' };
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });
        // check instructor a user
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const filter = { email: email }
            const user = await userCollection.findOne(filter);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        });

        // delete user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result)
        });
        // create user on mongodb
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existUser = await userCollection.findOne(query);
            if (existUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        });

        // update user as admin
        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        // update user as instructors
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        // admin related api
        app.get('/admin/classes', verifyJWT, async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        });
        // update user as admin
        app.patch('/classes/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'Approved'
                },
            }
            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        app.patch('/classe/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: 'Denied'
                },
            }
            const result = await classCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        // manage instructors route api
        app.post('/classes', async (req, res) => {
            const allClass = req.body;
            const result = await classCollection.insertOne(allClass);
            res.send(result)
        });
        app.get('/classes/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await classCollection.find(query).toArray();
            res.send(result);
        })
        // get all instructor only
        app.get('/instructors', async (req, res) => {
            const filter = { role: 'instructor' };
            const result = await userCollection.find(filter).toArray();
            res.send(result);
        });
        //  get all approved classes
        app.get('/approve-classes', async (req, res) => {
            const filter = { status: 'Approved' }
            const result = await classCollection.find(filter).toArray();
            res.send(result)
        });
        // course select api
        // get current user is admin or instructors or student
        app.get('/current-user/:email', async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const currentUser = await userCollection.findOne(query);
            res.send(currentUser);
        })

        // payment apis
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            const query = { _id: new ObjectId(payment.productId) }
            const deleteResult = await newSelectClass.deleteOne(query);
            res.send({ result, deleteResult })
        });
        app.get('/payments', async (req, res) => {
            const query = { user: req.query.email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        });
        // feedback related api this is feedback post and save to db api
        app.post('/admin/feedback', async (req, res) => {
            const feedback = req.body;
            const result = await feedbackCollection.insertOne(feedback);
            res.send(result)
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


// default route
app.get('/', (req, res) => {
    res.send("English Learning Site Is Running")
});
app.listen(port, () => {
    console.log("the server is running on :", port)
})