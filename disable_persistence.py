import os

file_path = 'client/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target block
old_persistence = """                // Enable Offline Persistence
                db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                    console.warn("Firestore Persistence Error:", err.code);
                });"""

new_persistence = """                // Enable Offline Persistence (DISABLED for Viva Signaling Stability)
                // db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
                //     console.warn("Firestore Persistence Error:", err.code);
                // });"""

if old_persistence in content:
    content = content.replace(old_persistence, new_persistence)
    print("Disabled Firestore persistence.")
else:
    print("WARNING: Exact persistence block not found. Trying loose match...")
    # Fallback: Try to find just the enablePersistence line
    if "db.enablePersistence" in content:
        content = content.replace("db.enablePersistence", "// db.enablePersistence")
        print("Commented out db.enablePersistence line.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
