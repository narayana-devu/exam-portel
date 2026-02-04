// app.js

const { useState, useEffect, useMemo } = React;
const { createRoot } = ReactDOM;

// --- ICONS ---
const Icons = {
    User: () => <i data-lucide="user" className="w-5 h-5"></i>,
    LogOut: () => <i data-lucide="log-out" className="w-5 h-5"></i>,
    Camera: () => <i data-lucide="camera" className="w-5 h-5"></i>,
    Plus: () => <i data-lucide="plus" className="w-5 h-5"></i>,
    Trash: () => <i data-lucide="trash-2" className="w-4 h-4"></i>,
    Users: () => <i data-lucide="users" className="w-5 h-5"></i>,
    Key: () => <i data-lucide="key" className="w-5 h-5"></i>,
    Eye: () => <i data-lucide="eye" className="w-5 h-5"></i>,
    RefreshCw: () => <i data-lucide="refresh-cw" className="w-5 h-5"></i>,
};

// --- COMPONENTS ---

// 1. LOGIN SCREEN
const LoginScreen = ({ onLogin }) => {
    const [role, setRole] = useState('student'); // admin, student, assessor
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        // Mock Auth Logic
        if (role === 'admin') {
            if (username === 'admin' && password === 'admin') {
                onLogin({ role: 'admin', name: 'Administrator' });
            } else {
                setError('Invalid Admin Credentials (Try admin/admin)');
            }
        } else if (role === 'assessor') {
            const assessorBatch = window.Utils.authenticateAssessor(username, password);
            if (assessorBatch) {
                onLogin({ role: 'assessor', name: 'Assessor (' + assessorBatch.name + ')', batchId: assessorBatch.id });
            } else {
                setError('Invalid Assessor Credentials');
            }
        } else {
            // Student Auth
            const student = window.Utils.authenticateStudent(username, password);
            if (student) {
                onLogin({ role: 'student', ...student });
            } else {
                setError('Invalid Student Credentials. Ask Admin to generate them.');
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md glass">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">SmarterExam</h1>
                <p className="text-center text-gray-500 mb-8">AI Proctored Examination System</p>

                <div className="flex justify-center gap-4 mb-6">
                    {['student', 'admin', 'assessor'].map(r => (
                        <button
                            key={r}
                            onClick={() => setRole(r)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${role === r
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transform hover:scale-[1.02] transition-all"
                    >
                        Login as {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                    <div className="text-center text-xs text-gray-400 mt-4">
                        <p>Credentials for Demo:</p>
                        <p>Admin: admin/admin | Assessor: assessor/assessor</p>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- ADMIN DASHBOARD ---
const AdminDashboard = ({ user }) => {
    const [activeTab, setActiveTab] = useState('batches'); // batches, monitoring
    const [subjects, setSubjects] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create Subject Inputs
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCode, setNewSubjectCode] = useState('');

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = () => {
        setSubjects(window.Utils.getSubjects());
    };

    const handleCreateSubject = (e) => {
        e.preventDefault();
        const subjectId = window.Utils.generateId();

        const newSubject = {
            id: subjectId,
            name: newSubjectName,
            code: newSubjectCode,
            createdAt: new Date().toISOString()
        };
        window.Utils.saveSubject(newSubject);

        alert(`Subject "${newSubjectName}" Created!`);

        setShowCreateModal(false);
        setNewSubjectName('');
        setNewSubjectCode('');
        refreshData();
    };

    const deleteSubject = (id) => {
        if (confirm('Delete this subject?')) {
            window.Utils.deleteSubject(id);
            refreshData();
        }
    };

    return (
        <div className="p-4 sm:p-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800">Admin Dashboard</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('batches')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'batches' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Icons.Users /> Batches
                    </button>
                    <button
                        onClick={() => setActiveTab('monitoring')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${activeTab === 'monitoring' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <Icons.Eye /> Live Monitor
                    </button>
                </div>
            </div>

            {activeTab === 'batches' && (
                <div className="space-y-6">
                    {/* Header with Stats & Action */}
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Icons.Globe />
                            <span className="font-bold text-gray-700">Total Records : {subjects.length}</span>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded shadow-md flex items-center gap-2 transition-all font-medium text-sm"
                        >
                            Add New Subject
                        </button>
                    </div>

                    {/* Subjects Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase tracking-wide">
                                    <th className="p-4 font-bold border-r border-gray-200 w-16 text-center">Sr.#</th>
                                    <th className="p-4 font-bold border-r border-gray-200">Subject Name</th>
                                    <th className="p-4 font-bold border-r border-gray-200">Subject Code</th>
                                    <th className="p-4 font-bold w-48 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {subjects.map((sub, index) => (
                                    <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-center text-gray-500 border-r border-gray-100">{index + 1}</td>
                                        <td className="p-4 font-medium text-gray-800 border-r border-gray-100">{sub.name}</td>
                                        <td className="p-4 text-gray-600 border-r border-gray-100">{sub.code}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700">Edit</button>
                                                <button className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700">Logins</button>
                                                <button onClick={() => deleteSubject(sub.id)} className="bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200"><Icons.Trash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {subjects.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="p-8 text-center text-gray-400 italic">
                                            No subjects found. Add a new subject to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Add New Subject</h3>
                        <form onSubmit={handleCreateSubject} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                                <input
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="e.g. Agriculture"
                                    value={newSubjectName}
                                    onChange={e => setNewSubjectName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="e.g. ASCI"
                                    value={newSubjectCode}
                                    onChange={e => setNewSubjectCode(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold">Add Subject</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {activeTab === 'monitoring' && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
                    <h3 className="text-xl font-medium text-gray-800 mb-2">Live Monitoring</h3>
                    <p className="text-gray-500">Select a running exam to monitor student feeds.</p>
                    {/* Placeholder for future implementation */}
                    <div className="mt-8 flex justify-center items-center h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <span className="text-gray-400">No active exams detected</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const BatchCard = ({ batch, onDelete }) => {
    const [students, setStudents] = useState([]);

    useEffect(() => {
        setStudents(window.Utils.getStudentsByBatch(batch.id));
    }, [batch]);

    const handleGenerateCreds = () => {
        students.forEach(student => {
            if (!student.username) {
                // Generate simple creds: Firstname + Rand(3)
                const base = student.name.split(' ')[0].toLowerCase();
                const updatedStudent = {
                    ...student,
                    username: `${base}${Math.floor(Math.random() * 1000)}`,
                    password: Math.random().toString(36).slice(-6)
                };
                window.Utils.updateStudent(updatedStudent);
            }
        });
        setStudents(window.Utils.getStudentsByBatch(batch.id)); // Refresh local state
        alert('Credentials generated for all students!');
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-lg text-gray-800">{batch.name}</h3>
                    <p className="text-sm text-gray-500">Created: {new Date(batch.createdAt).toLocaleDateString()}</p>
                    {batch.assessorUsername && (
                        <p className="text-xs text-indigo-600 font-mono mt-1">
                            Assessor: {batch.assessorUsername} / {batch.assessorPassword}
                        </p>
                    )}
                </div>
                <button onClick={onDelete} className="text-gray-400 hover:text-red-500 transition-colors"><Icons.Trash /></button>
            </div>
            <div className="p-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-gray-600">{students.length} Students</span>
                    <button
                        onClick={handleGenerateCreds}
                        className="text-indigo-600 text-xs font-bold uppercase tracking-wide flex items-center gap-1 hover:underline"
                    >
                        <Icons.Key /> Generate Creds
                    </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {students.map(s => (
                        <div key={s.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-100 text-sm">
                            <span className="truncate w-1/2" title={s.name}>{s.name}</span>
                            {s.username ? (
                                <span className="text-green-600 font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-100">
                                    {s.username} / {s.password}
                                </span>
                            ) : (
                                <span className="text-orange-400 text-xs italic">Pending</span>
                            )}
                        </div>
                    ))}
                    {students.length === 0 && <p className="text-xs text-gray-400 italic">No students added.</p>}
                </div>
            </div>
            {/* TODO: Add Assessor UI */}
        </div>


    );
};


// --- STUDENT PORTAL (EXAM) ---
const StudentPortal = ({ user }) => {
    const [activeExam, setActiveExam] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300); // 5 mins
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [questions, setQuestions] = useState([]);

    // Proctoring State
    const [stream, setStream] = useState(null);
    const [activeTabWarning, setActiveTabWarning] = useState(false);

    useEffect(() => {
        // Load Questions (Mock)
        const q = JSON.parse(localStorage.getItem('se_exams') || '[]');
        setQuestions(q);
    }, []);

    // Timer Logic
    useEffect(() => {
        let timer;
        if (activeExam && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0) {
            handleSubmit();
        }
        return () => clearInterval(timer);
    }, [activeExam, timeLeft]);

    // Proctoring Logic (Simulated)
    useEffect(() => {
        if (activeExam) {
            startWebcam();
            const proctorInterval = setInterval(() => {
                captureSnapshot();
            }, 10000); // Every 10s check/snapshot

            return () => {
                clearInterval(proctorInterval);
                stopWebcam();
            };
        }
    }, [activeExam]);

    const [mediaRecorder, setMediaRecorder] = useState(null);
    const chunksRef = React.useRef([]);

    const startWebcam = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setStream(mediaStream);
            setTimeout(() => {
                const videoElement = document.getElementById('webcam-feed');
                if (videoElement) {
                    videoElement.srcObject = mediaStream;
                }
            }, 100);

            // Start Recording
            chunksRef.current = [];
            const recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm; codecs=vp9' });

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.start(1000); // 1s chunks
            setMediaRecorder(recorder);

        } catch (err) {
            alert("Webcam currently unavailable. Please ensure you have given permission. (Check URL bar icons)");
            console.error(err);
        }
    };

    const stopWebcam = () => {
        return new Promise((resolve) => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                    resolve(blob);
                };
                mediaRecorder.stop();
            } else {
                if (chunksRef.current.length > 0) {
                    resolve(new Blob(chunksRef.current, { type: 'video/webm' }));
                } else {
                    resolve(null);
                }
            }

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        });
    };

    const captureSnapshot = () => {
        const video = document.getElementById('webcam-feed');
        if (video) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
        }
    };

    const handleStartExam = () => setActiveExam(true);

    const handleAnswer = (val) => {
        setAnswers({ ...answers, [currentQ]: val });
    };

    const handleSubmit = async () => {
        let videoBlob = null;
        if (activeExam) {
            videoBlob = await stopWebcam();
        }
        setActiveExam(false);

        // Save Result
        const submission = {
            studentId: user.id,
            examId: 'exam_001',
            answers: answers,
            score: calculateScore(),
            submittedAt: new Date().toISOString(),
            evidence: []
        };

        const saveAndAlert = async () => {
            await window.Utils.saveResponse(submission);
            alert("Exam Submitted Successfully! Starting Upload...");
            window.Utils.uploadToCloud(false); // Trigger visible sync
        };

        if (videoBlob) {
            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(videoBlob);
            reader.onloadend = () => {
                submission.evidence.push({
                    type: 'VIDEO_WEBCAM',
                    timestamp: new Date().toISOString(),
                    img: reader.result
                });
                saveAndAlert();
            };
        } else {
            saveAndAlert();
        }
    };

    const calculateScore = () => {
        let score = 0;
        questions.forEach((q, idx) => {
            if (answers[idx] === q.answer) score++;
        });
        return score;
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (activeExam) {
        return (
            <div className="flex flex-col h-screen fixed inset-0 z-50 bg-white">
                {/* Exam Header */}
                <div className="bg-indigo-900 text-white p-4 flex justify-between items-center shadow-lg">
                    <h2 className="font-bold text-xl">Final Examination</h2>
                    <div className="flex gap-6 items-center">
                        <div className="bg-red-600 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
                            REC ●
                        </div>
                        <div className="text-2xl font-mono font-bold">{formatTime(timeLeft)}</div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Main Question Area */}
                    <div className="flex-1 p-8 overflow-y-auto w-full">
                        <div className="max-w-3xl mx-auto">
                            <div className="mb-8">
                                <span className="text-gray-500 font-medium uppercase tracking-wide">Question {currentQ + 1} of {questions.length}</span>
                                <h3 className="text-2xl font-bold text-gray-800 mt-2">{questions[currentQ]?.text}</h3>
                            </div>

                            <div className="space-y-4">
                                {questions[currentQ]?.options.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => handleAnswer(opt)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${answers[currentQ] === opt
                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-md'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-12 flex justify-between">
                                <button
                                    disabled={currentQ === 0}
                                    onClick={() => setCurrentQ(p => p - 1)}
                                    className="px-6 py-2 rounded-lg bg-gray-100 text-gray-600 font-medium disabled:opacity-50 hover:bg-gray-200 transition-all"
                                >
                                    Previous
                                </button>
                                {currentQ < questions.length - 1 ? (
                                    <button
                                        onClick={() => setCurrentQ(p => p + 1)}
                                        className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                    >
                                        Next Question
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        className="px-6 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                                    >
                                        Submit Exam
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / Proctor View */}
                    <div className="w-80 bg-gray-50 border-l border-gray-200 p-4 flex flex-col gap-4">
                        <div className="bg-black rounded-xl overflow-hidden shadow-lg relative aspect-video border-2 border-indigo-500">
                            <video id="webcam-feed" autoPlay muted playsInline className="w-full h-full object-cover"></video>
                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                AI Active
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 flex-1">
                            <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Icons.Eye /> Question Map</h4>
                            <div className="grid grid-cols-5 gap-2">
                                {questions.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={`h-10 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer transition-all ${currentQ === idx ? 'bg-indigo-600 text-white ring-2 ring-indigo-200' :
                                            answers[idx] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                            }`}
                                        onClick={() => setCurrentQ(idx)}
                                    >
                                        {idx + 1}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Student Exam Hall</h2>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto text-center">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                    <div className="scale-150"><Icons.Camera /></div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Final Assessment - Science</h3>
                <p className="text-gray-500 mb-6">Duration: 5 Minutes • AI Proctored • Video Recorded</p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-left text-sm text-yellow-800">
                    <p className="font-bold mb-1">⚠️ Exam Rules:</p>
                    <ul className="list-disc ml-5 space-y-1">
                        <li>Maintain eye contact with the screen.</li>
                        <li>Do not switch tabs (FullScreen enforced).</li>
                        <li>Webcam must remain active throughout the session.</li>
                    </ul>
                </div>

                <button
                    onClick={handleStartExam}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-[1.02] transition-all"
                >
                    Start Exam Now
                </button>
            </div>
        </div>
    );
};

// --- ASSESSOR PORTAL ---
const AssessorPortal = ({ user }) => {
    const [batchStudents, setBatchStudents] = useState([]);

    useEffect(() => {
        if (user.batchId) {
            setBatchStudents(window.Utils.getStudentsByBatch(user.batchId));
        }
    }, [user]);

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-4">Assessor Portal</h2>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="mb-4 text-gray-600">
                    Welcome, <strong>{user.name}</strong>. You are managing the batch.
                </p>

                <h3 className="font-bold text-lg text-gray-800 mb-4">Students in your Batch</h3>
                <div className="space-y-2">
                    {batchStudents.map(s => (
                        <div key={s.id} className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                            <span className="font-medium text-gray-700">{s.name}</span>
                            <span className={`text-xs px-2 py-1 rounded ${s.username ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {s.username ? 'Credentials Active' : 'No Credentials'}
                            </span>
                        </div>
                    ))}
                    {batchStudents.length === 0 && <p className="text-gray-500 italic">No students found in this batch.</p>}
                </div>
            </div>
        </div>
    );
};


// 2. MAIN APP COMPONENT
const App = () => {
    const [user, setUser] = useState(null);

    // Initial lucide icons render
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    });

    const handleLogout = () => setUser(null);

    if (!user) {
        return <LoginScreen onLogin={setUser} />;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                        <span className="font-bold text-gray-800 text-lg">SmarterExam</span>
                        <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium uppercase">{user.role}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span id="sync-status-text" className="text-sm text-gray-500 font-medium"></span>
                        <button
                            onClick={handleLogout}
                            className="text-gray-500 hover:text-red-600 flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {user.role === 'admin' && <AdminDashboard user={user} />}
                {user.role === 'student' && <StudentPortal user={user} />}
                {user.role === 'assessor' && <AssessorPortal user={user} />}
            </main>
        </div>
    );
};

// Render
const root = createRoot(document.getElementById('root'));
root.render(<App />);
