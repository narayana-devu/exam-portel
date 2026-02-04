// utils.js
// Mock Database Layer using LocalStorage

const DB_KEYS = {
    BATCHES: 'se_batches',
    STUDENTS: 'se_students',
    EXAMS: 'se_exams',
    RESPONSES: 'se_responses',
    ADMIN: 'se_admin'
};

const Utils = {
    // ID Generator
    generateId: () => Math.random().toString(36).substr(2, 9),

    // --- DATA ACCESS ---
    getBatches: () => JSON.parse(localStorage.getItem(DB_KEYS.BATCHES) || '[]'),

    saveBatch: (batch) => {
        const batches = Utils.getBatches();
        batches.push(batch);
        localStorage.setItem(DB_KEYS.BATCHES, JSON.stringify(batches));
    },

    deleteBatch: (batchId) => {
        let batches = Utils.getBatches();
        batches = batches.filter(b => b.id !== batchId);
        localStorage.setItem(DB_KEYS.BATCHES, JSON.stringify(batches));

        // Also cleanup students in that batch
        let students = Utils.getStudents();
        students = students.filter(s => s.batchId !== batchId);
        localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
    },

    getStudents: () => JSON.parse(localStorage.getItem(DB_KEYS.STUDENTS) || '[]'),

    // Get students specifically for a batch
    getStudentsByBatch: (batchId) => {
        return Utils.getStudents().filter(s => s.batchId === batchId);
    },

    saveStudent: (student) => {
        const students = Utils.getStudents();
        students.push(student);
        localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
    },

    // Update specific student (e.g. adding credentials)
    updateStudent: (updatedStudent) => {
        let students = Utils.getStudents();
        const index = students.findIndex(s => s.id === updatedStudent.id);
        if (index !== -1) {
            students[index] = updatedStudent;
            localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students));
        }
    },

    // Find student by credentials
    authenticateStudent: (username, password) => {
        const students = Utils.getStudents();
        return students.find(s => s.username === username && s.password === password);
    },

    // Authenticate Assessor against Batches
    authenticateAssessor: (username, password) => {
        const batches = Utils.getBatches();
        // Find batch where assessor creds match
        return batches.find(b => b.assessorUsername === username && b.assessorPassword === password);
    },

    // Save Exam Response/Activity
    saveResponse: (response) => {
        const responses = JSON.parse(localStorage.getItem(DB_KEYS.RESPONSES) || '[]');
        // Check if exists update, else push
        const existingHeader = responses.findIndex(r => r.studentId === response.studentId && r.examId === response.examId);
        if (existingHeader >= 0) {
            responses[existingHeader] = { ...responses[existingHeader], ...response };
        } else {
            responses.push(response);
        }
        localStorage.setItem(DB_KEYS.RESPONSES, JSON.stringify(responses));
    },

    getResponses: () => JSON.parse(localStorage.getItem(DB_KEYS.RESPONSES) || '[]'),

    // --- SEEDING ---
    seedData: () => {
        if (!localStorage.getItem(DB_KEYS.ADMIN)) {
            localStorage.setItem(DB_KEYS.ADMIN, JSON.stringify({ username: 'admin', password: 'password123' }));
        }
    }
};

// Initialize
Utils.seedData();

// Mock Question Bank
if (!localStorage.getItem(DB_KEYS.EXAMS)) {
    const mockExam = [
        { id: 1, text: "What is the capital of France?", options: ["London", "Berlin", "Paris", "Madrid"], answer: "Paris" },
        { id: 2, text: "Which language runs in the browser?", options: ["Java", "C++", "Python", "JavaScript"], answer: "JavaScript" },
        { id: 3, text: "What does DOM stand for?", options: ["Data Object Model", "Document Object Model", "Digital Ordinance Model", "None"], answer: "Document Object Model" }
    ];
    localStorage.setItem(DB_KEYS.EXAMS, JSON.stringify(mockExam));
}

window.Utils = Utils; // Expose to window
