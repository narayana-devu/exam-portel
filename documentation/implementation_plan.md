# Robust Factory Reset Implementation Plan

## Problem
The current "Factory Reset" function only deletes cloud documents that correspond to IDs present in the device's local storage. If another device has uploaded data that the current device hasn't synced (or if data was partially deleted locally but not remotely), that data remains in the cloud ("Zombie Data"). Consequently, other devices syncing with the cloud will continue to see this data.

## Goal
Update `window.Utils.factoryReset` to perform a comprehensive cloud wipe by:
1.  Iterating through all known Firestore collections.
2.  Fetching **ALL** documents from each collection (instead of relying on local IDs).
3.  Deleting every document found.
4.  Clearing local storage only after the cloud wipe is initiated.

## Proposed Changes

### `d:\word\web\client\index.html`

#### [MODIFY] `window.Utils.factoryReset`
- Update the function to iterate over a comprehensive list of collections: `ssc`, `qps`, `nos`, `pcs`, `batches`, `students`, `assessors` (mapped from `se_assessors` key), `responses`, `question_papers`, and `synced_chunks`.
- For each collection:
    - Call `db.collection(route).get()` to fetch all documents.
    - Iterate through `snapshot.docs` and delete each document reference.
    - Use `await Promise.all()` for parallelism within legitimate limits (or batching if needed, but simple iteration is likely fine for this scale).
- Add better status feedback (e.g., "Wiping Cloud: [Collection Name]...").

## Verification Plan

1.  **Code Review**: Verify the logic iterates *remote* snapshots.
2.  **User Verification (Critical)**:
    - User must perform "Factory Reset" on Device A.
    - User must verify Device A is empty.
    - User must then go to Device B (which still has data).
    - User must click "Sync/Download" on Device B.
    - Device B should update to show **NO data** (since cloud is empty and `downloadFromCloud` overwrites local state).

## Risks
- **Network Traffic**: Fetching all docs to delete them involves reading them first. For massive datasets, this is slower, but acceptable for a "Factory Reset" operation.
- **Permission Denied**: If security rules prevent listing/deleting, it might fail. The user is Admin, so it should be fine.
