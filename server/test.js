const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/codeclash').then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection('problems');
    const problem = await collection.findOne({ title: { $regex: /tram/i } });
    console.log(JSON.stringify(problem, null, 2));
    mongoose.disconnect();
});
