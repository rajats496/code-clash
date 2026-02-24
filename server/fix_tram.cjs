const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/codeclash').then(async () => {
    try {
        const db = mongoose.connection.db;
        const collection = db.collection('problems');

        // Find the tram problem
        const problem = await collection.findOne({ title: "Tram" });
        if (!problem) {
            console.log("Tram problem not found!");
            process.exit(1);
        }

        console.log("Found problem:", problem.title);

        // Locate the bad test case (input: '2\n3 2\n0 4')
        const badTestCaseIndex = problem.testCases.findIndex(tc => tc.input === '2\n3 2\n0 4');

        if (badTestCaseIndex === -1) {
            console.log("Could not find the specific bad test case. It may have already been changed.");
        } else {
            // Fix the test case: On stop 1, 0 exit, 2 enter. On stop 2, 2 exit, 4 enter.
            // Math: Stop 1: 0 - 0 + 2 = 2. Stop 2: 2 - 2 + 4 = 4. 
            // Expected max capacity = 4.
            const fixedTestCase = {
                ...problem.testCases[badTestCaseIndex],
                input: '2\n0 2\n2 4',
                expectedOutput: '4'
            };

            problem.testCases[badTestCaseIndex] = fixedTestCase;

            const result = await collection.updateOne(
                { _id: problem._id },
                { $set: { testCases: problem.testCases } }
            );

            console.log("Update result:", result.modifiedCount === 1 ? "SUCCESS" : "FAILED (no changes)");
            console.log("New test case 3:", fixedTestCase);
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
});
