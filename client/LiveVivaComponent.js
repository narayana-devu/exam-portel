
// LIVE VIVA CONSOLE (SIMULATOR -> REAL WEBRTC)
const LiveVivaConsole = ({ batch, student, onClose }) => {
    const [stream, setStream] = useState(null); // Local Stream
    const [remoteStream, setRemoteStream] = useState(null); // Remote Stream
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [marks, setMarks] = useState({});
    const [remarks, setRemarks] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');

    const videoRef = useRef(null); // Local
    const remoteVideoRef = useRef(null); // Remote
    const socketRef = useRef(null);
    const peerRef = useRef(null);

    // Load QP (Viva or Practical)
    const allQPs = window.Utils.getQuestionPapers();
    // Prioritize Viva Paper, then Practical
    const qpId = batch.vivaPaperId || batch.practicalPaperId;
    const qp = allQPs.find(q => q.id === qpId);
    const questions = qp?.questions || [];

    useEffect(() => {
        // 1. Initialize Socket
        // 1. Initialize Socket
        // Support localhost, 127.0.0.1, and local network IPs (e.g. 10.x.x.x, 192.168.x.x)
        const isProduction = window.location.hostname === 'exam-portal-2004.web.app';
        const SERVER_URL = isProduction ? 'https://portel-backend.onrender.com' : `http://${window.location.hostname}:5000`;
        console.log("Connecting to Socket Server:", SERVER_URL);

        socketRef.current = io(SERVER_URL);
        const socket = socketRef.current;
        // Unique Room for 1-on-1: BatchID_StudentID
        const roomId = `${batch.id}_${student.id}`;

        setConnectionStatus(`Joining Room: ${roomId}...`);
        if (socket) socket.emit('join-room', roomId, 'assessor');

        // 2. Initialize PeerConnection
        peerRef.current = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        const pc = peerRef.current;

        // 3. Get Local Media
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(s => {
                setStream(s);
                if (videoRef.current) videoRef.current.srcObject = s;
                // Add Tracks to Peer
                s.getTracks().forEach(track => pc.addTrack(track, s));
            })
            .catch(err => alert("Camera Error: " + err.message));

        // 4. Handle ICE Candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('signal', { roomId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };

        // 5. Handle Remote Stream
        pc.ontrack = (event) => {
            console.log("Remote Stream Received");
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
            setConnectionStatus('Connected');
        };

        // 6. Signaling Handlers
        if (socket) {
            socket.on('user-connected', async (userId) => {
                console.log("Student Connected:", userId);
                setConnectionStatus('Student Connected. Calling...');
                // Assessor Initiates Offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('signal', { roomId, signal: { type: 'offer', sdp: offer } });
            });

            socket.on('signal', async (data) => {
                if (!data.signal) return;
                // Avoid self-signal if broadcasted back? (Socket.io room usually broadcasts to others, but good to check sender)
                if (data.sender === socket.id) return;

                if (data.signal.type === 'offer') {
                    // If student initiated (unlikely in this flow, but possible)
                    await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('signal', { roomId, signal: { type: 'answer', sdp: answer } });
                } else if (data.signal.type === 'answer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
                } else if (data.signal.type === 'candidate') {
                    await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
                }
            });
        }

        // Cleanup
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (peerRef.current) peerRef.current.close();
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    // Ensure remote video ref is attached when stream arrives
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, remoteVideoRef.current]);


    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !videoEnabled);
            setVideoEnabled(!videoEnabled);
        }
    };

    const toggleAudio = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !audioEnabled);
            setAudioEnabled(!audioEnabled);
        }
    };

    const handleSave = () => {
        // Save marks to responses
        const response = {
            id: window.Utils.generateId(),
            studentId: student.id,
            batchId: batch.id,
            examType: 'VIVA',
            answers: {},
            assessorMarks: marks,
            assessorRemarks: remarks,
            totalScore: Object.values(marks).reduce((a, b) => a + parseFloat(b || 0), 0),
            submittedAt: new Date().toISOString()
        };
        window.Utils.saveResponse(response);
        alert("Viva Completed & Marks Saved!");
        onClose();
    };

    if (!qp) return <div className="p-8 text-white bg-gray-900 h-screen">No Viva/Practical Question Paper Assigned to Batch. <button onClick={onClose} className="text-blue-400">Close</button></div>;

    return (
        <div className="fixed inset-0 bg-gray-900 z-50 flex text-white font-sans">
            {/* Left: Video Feed */}
            <div className="w-3/5 relative bg-black flex items-center justify-center group">

                {/* REMOTE VIDEO (STUDENT) - MAIN */}
                {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center text-gray-400 animate-pulse">
                        <Icons.Loader className="w-12 h-12 mb-4" />
                        <p>{connectionStatus}</p>
                        <p className="text-xs mt-2">Waiting for student to join room...</p>
                    </div>
                )}

                {/* SELF VIEW (PIP) */}
                <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg border border-gray-600 overflow-hidden shadow-2xl">
                    <video ref={videoRef} autoPlay muted className="w-full h-full object-cover transform scale-x-[-1]" />
                    <div className="absolute bottom-1 left-2 text-xs font-bold text-white drop-shadow-md">You</div>
                </div>

                <div className="absolute top-4 left-4 bg-black/50 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${remoteStream ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {remoteStream ? 'Live: ' + student.name : 'Disconnected'}
                </div>

                {/* Controls */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={toggleAudio} className={`p-4 rounded-full ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-all`}>
                        {audioEnabled ? <Icons.Microphone className="w-6 h-6" /> : <Icons.MicrophoneOff className="w-6 h-6" />}
                    </button>
                    <button onClick={toggleVideo} className={`p-4 rounded-full ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'} transition-all`}>
                        {videoEnabled ? <Icons.Video className="w-6 h-6" /> : <Icons.VideoOff className="w-6 h-6" />}
                    </button>
                    <button onClick={onClose} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-all text-white font-bold px-8">
                        End Call
                    </button>
                </div>
            </div>

            {/* Right: Grading Panel */}
            <div className="w-2/5 bg-white text-gray-800 flex flex-col h-full border-l border-gray-700">
                <div className="p-6 bg-indigo-600 text-white shadow-md">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Cpu className="w-5 h-5" /> Viva Grading</h2>
                    <p className="text-indigo-200 text-sm">QP: {qp.qpName}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {questions.map((q, idx) => (
                        <div key={q.id} className={`mb-6 p-4 rounded-lg border ${currentQIdx === idx ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Question {idx + 1}</span>
                                <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded">Max: {q.totalMarks}</span>
                            </div>
                            <p className="font-bold text-lg mb-4 text-gray-800 leading-snug">{q.question}</p>

                            {/* Scenario Text if any (Usually part of question, but we can highlight) */}

                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-700">Marks:</label>
                                <input
                                    type="number"
                                    max={q.totalMarks}
                                    min="0"
                                    className="w-24 p-2 border-2 border-gray-300 rounded-lg text-center font-bold text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                                    value={marks[idx] || ''}
                                    onChange={e => {
                                        const val = Math.min(parseFloat(e.target.value) || 0, q.totalMarks);
                                        setMarks({ ...marks, [idx]: val });
                                    }}
                                    onFocus={() => setCurrentQIdx(idx)}
                                />
                            </div>
                        </div>
                    ))}

                    <hr className="my-6 border-gray-200" />

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Overall Remarks</label>
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            rows="3"
                            placeholder="Enter detailed feedback for the student..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-sm">
                        <span className="text-gray-500">Total Score:</span>
                        <strong className="text-2xl ml-2 text-indigo-700">{Object.values(marks).reduce((a, b) => a + parseFloat(b || 0), 0)}</strong>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-500 font-bold">{qp.totalMarks}</span>
                    </div>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transform hover:-translate-y-1 transition-all flex items-center gap-2">
                        <Icons.Save className="w-5 h-5" /> Submit Evaluation
                    </button>
                </div>
            </div>
        </div>
    );
};
