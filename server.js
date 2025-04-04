const express = require('express');
const collection = require("./mongo.js"); // MongoDB collection
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const PORT = 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google Generative AI with API key
const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.send("Gemini Quiz Server is Running");
});

// Chat API route
app.post('/gemini', async (req, res) => {
    console.log(req.body.history);
    console.log(req.body.message);
    try {
        const model = genAi.getGenerativeModel({ model: 'gemini-pro' });
        const chat = model.startChat({
            history: req.body.history.map(entry => ({
                role: entry.role,
                parts: [{ text: entry.text }]
            })),
        });
        const msg = req.body.message;
        const result = await chat.sendMessage([{ text: msg }]);
        const text = result.response.text();
        console.log(text);
        res.send(text);
    } catch (error) {
        console.error("Gemini Chat Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Quiz generation API route
app.post('/gemini/quiz', async (req, res) => {
    const topic = req.body.topic;
    const difficulty = req.body.difficulty;

    try {
        const model = genAi.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([
            { text: `Generate a ${difficulty} quiz with one-word answers. 10 questions on ${topic}. Format: "Question :: Answer".` }
        ]);

        const text = result.response.text();
        console.log(text);

        // Process the response
        const parts = text.split('\n').filter(line => line.trim() !== '');
        let questions = [];
        let answers = [];

        parts.forEach(line => {
            const [question, answer] = line.split("::");
            if (question && answer) {
                questions.push(question.trim());
                answers.push(answer.trim());
            }
        });

        res.json({ questions, answers });
    } catch (error) {
        console.error("Quiz Generation Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Check if user exists
app.post("/", async (req, res) => {
    const { email } = req.body;

    try {
        const check = await collection.findOne({ email });

        if (check) {
            res.json("exist");
        } else {
            res.json("notexist");
        }
    } catch (error) {
        console.error("User Check Error:", error);
        res.json("fail");
    }
});

// Signup route
app.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;

    const data = {
        email,
        password,
        name,
        gold: 0,
        silver: 0,
        bronze: 0,
    };

    try {
        const check = await collection.findOne({ email });

        if (check) {
            res.json("exist");
        } else {
            await collection.insertOne(data);
            res.json("notexist");
        }
    } catch (error) {
        console.error("Signup Error:", error);
        res.json("fail");
    }
});

// Save user rating
app.post("/save-rating", async (req, res) => {
    const { rating, email } = req.body;

    try {
        const user = await collection.findOne({ email });

        if (user) {
            const ratingCollection = collection.db.collection("ratings");
            const existingRating = await ratingCollection.findOne({ email });

            if (existingRating) {
                await ratingCollection.updateOne(
                    { email },
                    { $set: { rating, date: new Date() } }
                );
                res.json({ status: "success", message: "Rating updated successfully" });
            } else {
                await ratingCollection.insertOne({ email, rating, date: new Date() });
                res.json({ status: "success", message: "Rating saved successfully" });
            }
        } else {
            res.status(404).json({ status: "fail", message: "User not found" });
        }
    } catch (error) {
        console.error("Save Rating Error:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// Save score and update medals
app.post("/save-score", async (req, res) => {
    const { email, score } = req.body;

    try {
        const user = await collection.findOne({ email });

        if (user) {
            let updateFields = { $set: { score } };

            if (score === 10) {
                updateFields.$inc = { gold: 1 };
            } else if (score >= 8) {
                updateFields.$inc = { silver: 1 };
            } else if (score >= 6) {
                updateFields.$inc = { bronze: 1 };
            }

            await collection.updateOne({ email }, updateFields);
            res.json({ status: "success", message: "Score and medals updated successfully" });
        } else {
            res.status(404).json({ status: "fail", message: "User not found" });
        }
    } catch (error) {
        console.error("Save Score Error:", error);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// Get user's medal counts
app.post("/get-medal-counts", async (req, res) => {
    const { email } = req.body;

    try {
        const user = await collection.findOne({ email });

        if (user) {
            res.json({
                gold: user.gold || 0,
                silver: user.silver || 0,
                bronze: user.bronze || 0,
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Get Medal Counts Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
