import os

file_path = 'client/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. INSERT VivaSignaling CLASS
# Insert after window.VideoDB definition (around line 190)
video_db_end = "        window.Utils = {"
viva_signaling_code = """
        // VIVA SIGNALING HELPER (Firestore WebRTC)
        class VivaSignaling {
            constructor(batchId, studentId, role) {
                this.batchId = batchId;
                this.studentId = studentId;
                this.role = role; // 'host' or 'student'
                this.roomId = `${batchId}_${studentId}`;
                this.roomRef = db.collection('viva_sessions').doc(this.roomId);
                this.candidatesCollection = this.roomRef.collection(role === 'host' ? 'student_candidates' : 'host_candidates');
            }

            async createRoom() {
                await this.roomRef.set({
                    createdAt: new Date().toISOString(),
                    hostOnline: true
                }, { merge: true });
            }

            async joinRoom() {
                const doc = await this.roomRef.get();
                if (!doc.exists) throw new Error("Room not found. Assessor must start the session first.");
            }

            // Listen for Remote Description (Offer/Answer)
            onRemoteDescription(callback) {
                return this.roomRef.onSnapshot(snapshot => {
                    const data = snapshot.data();
                    if (!data) return;
                    // If Host: Listen for Answer. If Student: Listen for Offer.
                    if (this.role === 'host' && data.answer && !this.processedAnswer) {
                        this.processedAnswer = true;
                        callback(data.answer);
                    }
                    if (this.role === 'student' && data.offer && !this.processedOffer) {
                        this.processedOffer = true;
                        callback(data.offer);
                    }
                });
            }

            async sendOffer(offer) {
                await this.roomRef.update({ offer: { type: offer.type, sdp: offer.sdp } });
            }

            async sendAnswer(answer) {
                await this.roomRef.update({ answer: { type: answer.type, sdp: answer.sdp } });
            }

            // ICE Candidates
            async sendIceCandidate(candidate) {
                const targetCollection = this.roomRef.collection(this.role === 'host' ? 'host_candidates' : 'student_candidates');
                await targetCollection.add(candidate.toJSON());
            }

            onIceCandidate(callback) {
                const sourceCollection = this.roomRef.collection(this.role === 'host' ? 'student_candidates' : 'host_candidates');
                return sourceCollection.onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            callback(change.doc.data());
                        }
                    });
                });
            }
        }
"""

if "class VivaSignaling" not in content:
    content = content.replace(video_db_end, viva_signaling_code + "\n" + video_db_end)
    print("Inserted VivaSignaling class.")
else:
    print("VivaSignaling class already present.")

# 2. INSERT VivaLobby COMPONENT
# Insert before AssessorPortal definition
assessor_portal_start = "// ASSESSOR PORTAL"
viva_lobby_code = """
        // VIVA LOBBY COMPONENT (Assessor Side)
        const VivaLobby = ({ batch, onClose }) => {
            const [students, setStudents] = useState([]);
            const [selectedStudent, setSelectedStudent] = useState(null);
            const [remoteStream, setRemoteStream] = useState(null);
            const [connectionStatus, setConnectionStatus] = useState('idle'); // idle, connecting, connected, disconnected
            
            const localVideoRef = useRef(null);
            const remoteVideoRef = useRef(null);
            const peerRef = useRef(null);
            const signalingRef = useRef(null);
            const localStreamRef = useRef(null);

            useEffect(() => {
                setStudents(window.Utils.getStudentsByBatch(batch.id));
            }, [batch]);

            const startCall = async (student) => {
                setSelectedStudent(student);
                setConnectionStatus('connecting');

                // 1. Setup Signaling
                const signaling = new VivaSignaling(batch.id, student.id, 'host');
                signalingRef.current = signaling;
                await signaling.createRoom();

                // 2. Setup PeerConnection
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                peerRef.current = pc;

                // 3. Add Local Stream
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    localStreamRef.current = stream;
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                    stream.getTracks().forEach(track => pc.addTrack(track, stream));
                } catch (e) {
                    alert("Camera Error: " + e.message);
                    setConnectionStatus('error');
                    return;
                }

                // 4. Handle Remote Stream
                pc.ontrack = (event) => {
                    setRemoteStream(event.streams[0]);
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
                    setConnectionStatus('connected');
                };

                // 5. ICE Candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) signaling.sendIceCandidate(event.candidate);
                };
                signaling.onIceCandidate(candidate => {
                    pc.addIceCandidate(new RTCIceCandidate(candidate));
                });

                // 6. Create Offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await signaling.sendOffer(offer);

                // 7. Listen for Answer
                signaling.onRemoteDescription(async (answer) => {
                    if (!pc.currentRemoteDescription) {
                        await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    }
                });
            };

            const endCall = () => {
                if (peerRef.current) peerRef.current.close();
                if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
                setSelectedStudent(null);
                setRemoteStream(null);
                setConnectionStatus('idle');
            };

            return (
                <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col text-white">
                    {/* Header */}
                    <div className="p-4 bg-gray-800 flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold">Viva Lobby: {batch.name}</h2>
                            {connectionStatus === 'connected' && <span className="bg-green-600 text-xs px-2 py-1 rounded animate-pulse">LIVE</span>}
                        </div>
                        <button onClick={onClose} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold">Close Lobby</button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar: Student List */}
                        <div className="w-80 bg-gray-800 border-r border-gray-700 overflow-y-auto p-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Candidates</h3>
                            <div className="space-y-2">
                                {students.map(s => (
                                    <div key={s.id} 
                                        onClick={() => connectionStatus === 'idle' && startCall(s)}
                                        className={`p-3 rounded cursor-pointer flex items-center justify-between transition-colors ${selectedStudent?.id === s.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        <div>
                                            <p className="font-bold text-sm">{s.name}</p>
                                            <p className="text-xs text-gray-400">{s.username}</p>
                                        </div>
                                        {selectedStudent?.id === s.id && <Icons.Video className="w-4 h-4" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Main Video Area */}
                        <div className="flex-1 bg-black relative flex items-center justify-center">
                            {selectedStudent ? (
                                <>
                                    {/* Remote Video (Student) */}
                                    {remoteStream ? (
                                        <video ref={remoteVideoRef} autoPlay className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="text-center animate-pulse">
                                            <Icons.Loader className="w-16 h-16 mx-auto mb-4 text-indigo-500 animate-spin" />
                                            <p className="text-xl font-bold">Calling {selectedStudent.name}...</p>
                                            <p className="text-gray-400 text-sm mt-2">Waiting for student to join...</p>
                                        </div>
                                    )}

                                    {/* Local Video (Assessor) - PIP */}
                                    <div className="absolute bottom-6 right-6 w-48 h-36 bg-gray-900 rounded-lg border-2 border-gray-700 shadow-xl overflow-hidden">
                                        <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover transform scale-x-[-1]" />
                                    </div>

                                    {/* Controls */}
                                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                                        <button onClick={endCall} className="bg-red-600 hover:bg-red-700 p-4 rounded-full shadow-lg">
                                            <Icons.PhoneMissed className="w-6 h-6" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center text-gray-500">
                                    <Icons.Video className="w-24 h-24 mx-auto mb-4 opacity-20" />
                                    <p className="text-xl">Select a student to start Viva</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };
"""

if "const VivaLobby" not in content:
    content = content.replace(assessor_portal_start, viva_lobby_code + "\n" + assessor_portal_start)
    print("Inserted VivaLobby component.")
else:
    print("VivaLobby component already present.")

# 3. UPDATE StudentPortal (VivaLive Logic)
# Replace the existing dummy VivaLive implementation
old_viva_live_start = "                if (examMode === 'VivaLive') return ("
old_viva_live_end = "                );" # This is risky, need better matching

# We will replace the entire useEffect for VivaLive AND the render block
# First, let's inject the logic in the useEffect
# Find the useEffect that handles VivaLive
viva_effect_start = "            // WEBRTC STATE FOR VIVA LIVE"
viva_effect_end = "            }, [examMode, user.batchId]);"

new_viva_effect = """            // WEBRTC STATE FOR VIVA LIVE
            const [remoteStream, setRemoteStream] = useState(null);
            const peerRef = useRef(null);
            const signalingRef = useRef(null);

            useEffect(() => {
                if (examMode !== 'VivaLive') return;

                const initViva = async () => {
                    console.log("Initializing Viva Connection...");
                    
                    // 1. Signaling
                    const signaling = new VivaSignaling(user.batchId, user.id, 'student');
                    signalingRef.current = signaling;
                    
                    try {
                        await signaling.joinRoom();
                    } catch(e) {
                        alert(e.message);
                        setExamMode('VivaWait');
                        return;
                    }

                    // 2. PeerConnection
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });
                    peerRef.current = pc;

                    // 3. Local Stream
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        const video = document.getElementById('student-cam-viva');
                        if (video) video.srcObject = stream;
                        stream.getTracks().forEach(track => pc.addTrack(track, stream));
                    } catch (e) {
                        console.error("Viva Camera Error", e);
                    }

                    // 4. Remote Stream
                    pc.ontrack = (event) => {
                        console.log("Remote Stream Received");
                        setRemoteStream(event.streams[0]);
                        const remoteVid = document.getElementById('remote-assessor-video');
                        if(remoteVid) remoteVid.srcObject = event.streams[0];
                    };

                    // 5. ICE Candidates
                    pc.onicecandidate = (event) => {
                        if (event.candidate) signaling.sendIceCandidate(event.candidate);
                    };
                    signaling.onIceCandidate(candidate => {
                        pc.addIceCandidate(new RTCIceCandidate(candidate));
                    });

                    // 6. Listen for Offer
                    signaling.onRemoteDescription(async (offer) => {
                        console.log("Received Offer");
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        await signaling.sendAnswer(answer);
                    });
                };

                initViva();

                return () => {
                    if (peerRef.current) peerRef.current.close();
                    // Stop local tracks? Maybe keep them if we want fast reconnect
                };
            }, [examMode]);"""

# Replace the old useEffect
# We need to be careful about matching the exact old content
# Let's try to match by the comment line
if viva_effect_start in content:
    # Find the end of the block manually or use regex if needed
    # For now, let's assume the structure is consistent with what we saw in view_file
    # The old block ends with "}, [examMode, user.batchId]);"
    
    # We'll use a simpler replace strategy: find the start, find the end, replace range
    start_idx = content.find(viva_effect_start)
    end_idx = content.find(viva_effect_end, start_idx) + len(viva_effect_end)
    
    if start_idx != -1 and end_idx != -1:
        content = content[:start_idx] + new_viva_effect + content[end_idx:]
        print("Updated StudentPortal Viva logic.")
    else:
        print("Could not find end of Viva useEffect.")

# 4. UPDATE StudentPortal RENDER (Video Element ID)
# The old render used `ref={ref => ...}` which is fine, but we want to ensure it works with our new logic
# Our new logic tries to find `remote-assessor-video`
# The old code:
# <video
#     ref={ref => { if (ref && remoteStream) ref.srcObject = remoteStream }}
#     autoPlay
#     className="absolute inset-0 w-full h-full object-contain bg-black"
# />

old_video_render = """                                <video
                                    ref={ref => { if (ref && remoteStream) ref.srcObject = remoteStream }}
                                    autoPlay
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                />"""

new_video_render = """                                <video
                                    id="remote-assessor-video"
                                    ref={ref => { if (ref && remoteStream) ref.srcObject = remoteStream }}
                                    autoPlay
                                    className="absolute inset-0 w-full h-full object-contain bg-black"
                                />"""

if old_video_render in content:
    content = content.replace(old_video_render, new_video_render)
    print("Updated StudentPortal video render.")
else:
    # Try a looser match if exact whitespace fails
    pass 

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
