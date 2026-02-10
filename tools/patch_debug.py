import os

file_path = 'client/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Logging to VideoDB.saveVideo
search_save = """            saveVideo: async (key, blob) => {
                try {
                    const db = await VideoDB.init();
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction(VideoDB.storeName, 'readwrite');
                        tx.oncomplete = () => resolve();
                        tx.onerror = (e) => reject(e.target.error);
                        tx.objectStore(VideoDB.storeName).put(blob, key);
                    });
                } catch (e) {"""

replace_save = """            saveVideo: async (key, blob) => {
                console.log(`[VideoDB] Saving ${key} (Size: ${blob.size})...`);
                try {
                    const db = await VideoDB.init();
                    return new Promise((resolve, reject) => {
                        const tx = db.transaction(VideoDB.storeName, 'readwrite');
                        tx.oncomplete = () => {
                            console.log(`[VideoDB] Saved ${key} Successfully.`);
                            resolve();
                        };
                        tx.onerror = (e) => {
                            console.error(`[VideoDB] Save Failed for ${key}`, e.target.error);
                            reject(e.target.error);
                        };
                        tx.objectStore(VideoDB.storeName).put(blob, key);
                    });
                } catch (e) {"""

if search_save in content:
    content = content.replace(search_save, replace_save)
    print("Added logging to VideoDB.saveVideo")
else:
    print("Could not find VideoDB.saveVideo")

# 2. Add Logging to VideoDB.getVideo
search_get = """            getVideo: async (key) => {
                const db = await VideoDB.init();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(VideoDB.storeName, 'readonly');
                    const store = tx.objectStore(VideoDB.storeName);
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = (e) => reject(e.target.error);
                });
            }"""

replace_get = """            getVideo: async (key) => {
                // console.log(`[VideoDB] Fetching ${key}...`);
                const db = await VideoDB.init();
                return new Promise((resolve, reject) => {
                    const tx = db.transaction(VideoDB.storeName, 'readonly');
                    const store = tx.objectStore(VideoDB.storeName);
                    const request = store.get(key);
                    request.onsuccess = () => {
                        if (request.result) {
                            // console.log(`[VideoDB] Found ${key} (Size: ${request.result.size})`);
                            resolve(request.result);
                        } else {
                            console.warn(`[VideoDB] Key NOT FOUND: ${key}`);
                            resolve(undefined);
                        }
                    };
                    request.onerror = (e) => reject(e.target.error);
                });
            }"""

if search_get in content:
    content = content.replace(search_get, replace_get)
    print("Added logging to VideoDB.getVideo")
else:
    print("Could not find VideoDB.getVideo")

# 3. Add Verification in saveResponse
search_response = """                                await VideoDB.saveVideo(key, blob); // reusing generic Method
                                response.evidence[i] = { ...ev, img: key, storage: 'indexeddb' };"""

replace_response = """                                await VideoDB.saveVideo(key, blob); // reusing generic Method
                                
                                // VERIFY IMMEDIATE READ
                                const check = await VideoDB.getVideo(key);
                                if (!check) console.error(`[CRITICAL] Immediate Readback Failed for ${key}`);
                                else console.log(`[VideoDB] Verified ${key} exists.`);

                                response.evidence[i] = { ...ev, img: key, storage: 'indexeddb' };"""

if search_response in content:
    content = content.replace(search_response, replace_response)
    print("Added verification to saveResponse")
else:
    print("Could not find saveResponse insertion point")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
