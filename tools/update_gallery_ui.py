#!/usr/bin/env python3
"""Script to update Gallery UI with Session Grouping"""

path = 'client/index.html'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert SessionPlayer Component
# Find StudentGradingView definition
view_def = "const StudentGradingView = ({ student, batch, examType, allQPapers, onBack, captureOnly = false }) => {"

session_player_code = """        // SESSION PLAYER COMPONENT
        const SessionPlayer = ({ parts }) => {
            const [index, setIndex] = React.useState(0);
            const [src, setSrc] = React.useState(null);
            
            React.useEffect(() => {
                let active = true;
                const load = async () => {
                    setSrc(null);
                    try {
                        const blob = await VideoDB.getVideo(parts[index].key);
                        if(active && blob) setSrc(URL.createObjectURL(blob));
                    } catch(e) { console.error(e); }
                };
                load();
                return () => { active = false; };
            }, [index, parts]);

            return (
                <div className="relative bg-black w-full h-32 group-hover:h-auto transition-all">
                    {src ? (
                        <video 
                            src={src} 
                            controls 
                            autoPlay
                            className="w-full h-full object-contain"
                            onEnded={() => {
                                if(index < parts.length - 1) setIndex(index + 1);
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-white text-xs">
                            Loading Part {index + 1}...
                        </div>
                    )}
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] px-2 py-1 font-bold z-10">
                        Part {index + 1}/{parts.length}
                    </div>
                </div>
            );
        };

"""

if view_def in content and "const SessionPlayer" not in content:
    content = content.replace(view_def, session_player_code + view_def)
    print("✅ Inserted SessionPlayer component")
else:
    print("ℹ️ SessionPlayer might already exist or view_def not found")

# 2. Replace Gallery Logic
# I'll match the start of the IIFE
start_marker = """                                {(() => {
                                    let filtered = evidence;
                                    if (evidenceFilter === 'PHOTOS') filtered = evidence.filter(e => e.type?.includes('PHOTO') || e.type?.includes('IMG'));"""

# I need to find the end of this block. It's tricky with just string replace.
# But I can replace the start and insert the new logic, assuming the rest follows a pattern I can match or I replace the whole block if I have it.
# Since I don't have the FULL block in a single variable easily without reading the file carefully,
# I'll try to match a larger chunk including the return statement.

# Let's try to match the LOGS block start as a reference point.
logs_marker = """                                    if (evidenceFilter === 'LOGS') {
                                        return (
                                            <div className="space-y-2">"""

# The part I want to replace is AFTER the logs block.
# The logs block ends, then there is the main return for the grid.

# Let's construct the NEW content for the IIFE.
new_iife_content = """                                {(() => {
                                    let filtered = evidence;
                                    if (evidenceFilter === 'PHOTOS') filtered = evidence.filter(e => e.type?.includes('PHOTO') || e.type?.includes('IMG'));
                                    if (evidenceFilter === 'VIDEOS') filtered = evidence.filter(e => e.type?.includes('VIDEO'));
                                    if (evidenceFilter === 'LOGS') filtered = evidence.filter(e => !e.type?.includes('PHOTO') && !e.type?.includes('VIDEO'));

                                    if (filtered.length === 0) return <p className="text-gray-400 text-sm text-center py-8">No records found for {evidenceFilter}</p>;

                                    if (evidenceFilter === 'LOGS') {
                                        return (
                                            <div className="space-y-2">
                                                {filtered.map((e, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded border-l-4 border-amber-400">
                                                        <div className="flex items-center gap-3">
                                                            <Icons.TriangleAlert className="w-5 h-5 text-amber-500" />
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-800">{(e.type || 'UNKNOWN').replace(/_/g, ' ')}</p>
                                                                <p className="text-xs text-gray-500">System Flag</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-mono bg-white px-2 py-1 rounded border">{new Date(e.time).toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    // GROUPING LOGIC
                                    const grouped = [];
                                    const sessions = {};
                                    
                                    filtered.forEach(e => {
                                        if(e.sessionId) {
                                            if(!sessions[e.sessionId]) {
                                                sessions[e.sessionId] = { 
                                                    ...e, 
                                                    isGroup: true, 
                                                    parts: [],
                                                    type: 'VIDEO_SESSION' 
                                                };
                                                grouped.push(sessions[e.sessionId]);
                                            }
                                            sessions[e.sessionId].parts.push(e);
                                        } else {
                                            grouped.push(e);
                                        }
                                    });
                                    
                                    // Sort parts
                                    Object.values(sessions).forEach(s => s.parts.sort((a,b) => a.sequence - b.sequence));

                                    return (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {grouped.map((e, i) => (
                                                <div key={i} className="relative group bg-gray-100 rounded overflow-hidden border">
                                                    {e.isGroup ? (
                                                        <SessionPlayer parts={e.parts} />
                                                    ) : (
                                                        <>
                                                            {e.type.includes('VIDEO') ? (
                                                                e.key ? (
                                                                    // Use VideoPlayerDB if available, else fallback to video tag
                                                                    typeof VideoPlayerDB !== 'undefined' ? <VideoPlayerDB videoKey={e.key} /> :
                                                                    <SessionPlayer parts={[e]} /> 
                                                                ) : (
                                                                    <video src={e.img} controls className="w-full h-32 object-cover bg-black"
                                                                        onError={(ev) => {
                                                                            ev.target.style.display = 'none';
                                                                            ev.target.nextSibling.style.display = 'flex';
                                                                        }}
                                                                    />
                                                                )
                                                            ) : (
                                                                <img src={e.img} className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                                                                    onClick={() => {
                                                                        if (e.img.startsWith('blob:') || e.img.startsWith('data:')) {
                                                                            const w = window.open("");
                                                                            w.document.write(`<img src="${e.img}" style="max-width:100%"/>`);
                                                                        } else {
                                                                            alert("Image not available on this device. Please sync from the source device.");
                                                                        }
                                                                    }}
                                                                    onError={(ev) => {
                                                                        ev.target.style.display = 'none';
                                                                        ev.target.nextSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    {/* Fallback for Error */}
                                                    <div className="absolute inset-0 hidden flex-col items-center justify-center bg-gray-200 text-gray-500 p-2 text-center">
                                                        <Icons.XCircle className="w-8 h-8 mb-1" />
                                                        <span className="text-[10px] font-bold">Media Not Found</span>
                                                    </div>

                                                    <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] px-2 py-1 rounded-br">
                                                        {new Date(e.time).toLocaleTimeString()}
                                                    </div>
                                                    <div className="absolute inset-x-0 bottom-0 bg-white/90 p-2 text-xs font-bold truncate text-center border-t">
                                                        {e.isGroup ? `Exam Recording (${e.parts.length} Parts)` : e.type.replace(/_/g, ' ')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}"""

# I need to find the start and end of the OLD block to replace it.
# The old block starts with `start_marker` and ends with `})()}`.
# I'll use regex to find the block.

import re
# Escape the start marker for regex
escaped_start = re.escape(start_marker)
# Pattern: Start marker ... (anything) ... End marker
# We need to be careful not to match too much.
# The block ends with `})()}` followed by `</div>`.

# Let's try to locate the start index.
start_idx = content.find(start_marker)
if start_idx != -1:
    # Find the end of the IIFE
    # It ends before `</div>` which closes the `p-6` div.
    # I'll look for `</div>` after the start_idx.
    # But there are nested divs.
    # I'll look for the specific closing sequence `})()}`
    end_idx = content.find("})()}", start_idx)
    if end_idx != -1:
        end_idx += 5 # Include `})()}`
        
        # Verify it looks right
        old_block = content[start_idx:end_idx]
        # Replace
        content = content[:start_idx] + new_iife_content + content[end_idx:]
        print("✅ Replaced Gallery Logic")
    else:
        print("❌ Could not find end of IIFE block")
else:
    print("❌ Could not find start of IIFE block")
    # Debug
    print("Searching for:\n", start_marker[:100])

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
