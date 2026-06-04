const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("SELECT data FROM responses LIMIT 10", [], (err, rows) => {
    if (err) {
        console.error("Database query error:", err);
        return;
    }
    console.log(`Found ${rows.length} responses.`);
    rows.forEach((row, i) => {
        try {
            const data = JSON.parse(row.data);
            console.log(`\nResponse ${i + 1}:`);
            console.log(`- Student ID: ${data.studentId}`);
            console.log(`- Exam Type: ${data.examType}`);
            if (data.evidence) {
                console.log(`- Evidence count: ${data.evidence.length}`);
                data.evidence.forEach((ev, j) => {
                    console.log(`  [${j}] Type: ${ev.type}, Storage: ${ev.storage}`);
                    console.log(`      URL: ${ev.url}`);
                    console.log(`      Img: ${ev.img}`);
                });
            } else {
                console.log(`- No evidence field.`);
            }
        } catch (e) {
            console.error("Parse error:", e);
        }
    });
    db.close();
});
