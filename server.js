const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 8080;

//Middleware
// app.use(cors({
//     origin: ['https://scholarbase-production.up.railway.app', 'http://localhost:3000'],
//     methods: ['GET', 'POST', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));
app.use(cors());
app.use(express.json());


//MondoDB Connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri , {
        serverApi: {
            version: ServerApiVersion.v1,
            deprecationErrors: true,
        }
    }
);

//Database and collection variables
let database;
let articlesCollection;






async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        database = client.db("scholarBase");
        articlesCollection = database.collection("articles");

        //Debugging Logs
        console.log("Checking MongoDB connection:", database?.databaseName);
        console.log("Articles collection:", articlesCollection);


        //Create text index if it doesn't exist
        const indexExists = await articlesCollection.indexExists("textSearchIndex");
        if(!indexExists) {
            await articlesCollection.createIndex(
                {
                    articleTitle: "text",
                    abstract: "text",
                    journal: "text",
                    "researchers.name": "text"
                },
                { name: "textSearchIndex" }
            );
        console.log("Text search index created");
}



        //Send a ping to confirm successful connection
        await database.command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connect to MongoDB!");
    } catch (error) {
        console.error("Error connection to MongoDB:", error)
        process.exit(1);
    }
}

// Add these simple test endpoints
app.get('/', (req, res) => {
    res.json({ message: 'ScholarBase API is running' });
  });
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });


//Search API endpoint
app.get('/api/search', async (req, res) => {
    try {
        const searchTerm = req.query.term;

        if (!searchTerm) {
            return res.status(400).json({ message: "Search term is required" });
        }
        console.log("Search Term:", searchTerm);  // Log the search term

        const query = { $text: { $search: `"${searchTerm}"` } }; //Quotes added for exact phrase matching

        console.log("Mongo Query:", query);  // Log the MongoDB query

        const projection = { 
            score: { $meta: "textScore" },
            articleTitle: 1,
            journal: 1,
            publicationYear: 1,
            researchers: 1
        };
             
        const results = await articlesCollection
            .find(query, { projection })
            .sort({ score: { $meta: "textScore" } })
            .limit(20)
            .toArray();

        console.log("Search Results:", results.length);  // Log the results to verify they are returned

        res.json(results);
    } catch (error) {
        console.log("Error searching articles:", error);
        res.status(500).json({ 
            message: "Error searching articles",
            error: error.message 
    });
    }
});

//Start server
async function startServer() {
    await connectToMongoDB();
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
    
}

//Handle graceful shutdown
process.on('SIGINT', async () => {
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});



startServer().catch(console.error);