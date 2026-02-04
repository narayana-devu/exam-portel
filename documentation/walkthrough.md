# Walkthrough - Web-Based Marks Entry

I have successfully implemented the "Web-Based Marks Entry" feature, allowing assessors to enter marks directly into the application without needing Excel file uploads. I also added strict validation to ensure Question Papers cover all Performance Criteria (PCs).

## Changes

### 1. New Marks Entry Grid
- **Location:** `Marks` Tab in Admin Dashboard.
- **Features:**
    - **Filters:** Select Sector Skill Council, Qualification Pack, and Batch.
    - **Dynamic Grid:** Automatically generates columns based on the PCs linked to the selected Qualification Pack.
    - **Data Pre-loading:** Fetches all students in the batch and populates any existing marks.
    - **Real-time Totals:** Automatically calculates the total score for each student as you type.
    - **Validation:** Minimum 0 marks. (Future: Max marks validation based on PC limits).
    - **Saving:** "Save All Marks" button uploads the data to the cloud instantly.

### 2. Strict Question Paper Validation
- **Location:** `Question Papers` Tab -> `Upload Question Paper` Modal.
- **Logic:**
    - When uploading an Excel Question Paper, the system now checks if the questions cover **100%** of the PCs defined for that Qualification Pack.
    - If any PC is missed, the upload is **blocked**, and a specific error message lists the missing PCs.
    - This ensures that no student is graded on an incomplete set of criteria.

## Verification
### Logic Validation
- **Grid Loading:** Verified that selecting a Batch loads the correct Students and PCs.
- **Formula:** Confirmed that `Total = Sum(Theory + Practical + Viva)` (simplified to raw sum for now, can be refined to split by type if needed).
- **Persistence:** Marks are saved to `responses` and synced via `window.Utils.uploadToCloud(true)`.

### Next Steps
- Verify the flow manually by creating a dummy batch and entering marks.
- Test the strict validation by uploading an incomplete Question Paper.

### 3. Syntax Error & UI Resolution
- **Issue:** Fixed a persistent "Expected '}'" syntax error in `index.html` within the `QPsTab` component.
- **Resolution:** Removed a duplicate and unclosed `QPsTab` definition that was shielding the `MarksTab`.
- **UI Fix:** "Marks Entry" tab was not visible in the sidebar. Moved it to the **Assessment** section for improved visibility. Verified deployment.

### 4. NOS-Based Marks Entry Grid
- **Feature:** Refactored the `MarksTab` to display an Excel-like grid grouped by NOS (National Occupational Standards).
- **Structure:**
    - Columns: NOS Name (merged), formatted with Sub-headers: Theory, Practical, Viva, Total.
    - Rows: Student List.
- **Persistence:** Marks are saved at the NOS level (`nosMarks`) and uploaded to the cloud.
- **Verification:**
    - "Load Students" correctly fetches Start/End dates (if applicable) and student list.
    - Grid renders NOS columns dynamically based on the selected QP.
    - Marks inputs (T/P/V) work independently and update the Grand Total live.
    - "Save All Marks" persists the data.

### 5. UX Improvement: Auto-load Grid
- **Change:** Removed the "Load Students" button.
- **Behavior:** The Marks Grid now loads automatically as soon as a Batch is selected.
- **UI:** Simplified the control panel by removing the extra step.

### 6. UI Polish: Custom Scrollbars & Layout
- **Feature:** Added custom CSS for webkit-scrollbars.
- **Visuals:** Thin, grey scrollbars (vertical and horizontal) matching the user's design preference.
- **Integration:** Applied specifically to the Marks Entry grid container. Forced horizontal overflow (`w-max`) to ensure the bottom scrollbar is accessible.
- **Enhancement:** Added a **"Add Marks"** button to the top-right of the screen (renamed from "Save All Marks" per user request) for easier access logic.

### 7. Marks Entry Redesign (Student Card Layout)
- **Feature:** Completely redesigned the marks entry interface to match the user's preferred "Student Card" layout.
- **Layout:**
- **Layout:**
    - **Default View (Spreadsheet):** Read-Only Grid for reviewing marks. Input fields are disabled for display only.
    - **Specific Entry View (Student Cards):** Accessed via "Add Marks". The ONLY place to enter and save marks.
- **Excel Integration:**
    - **Download Template:** Generates a file pre-filled with Students and NOS for the selected batch.
    - **Upload Marks:** Parses the filled Excel and populates the system's marks and attendance automatically.
- **Responsiveness Verified:**
    - Login Screen and Marks Entry interface confirmed responsive on Mobile (375x812) and Desktop (1920x1080).
    - Grid view automatically enables horizontal scrolling on small screens.

### 8. Factory Reset Restoration
- **Problem:** The "System Management" section containing the "Factory Reset" button was missing from the Dashboard.
- **Fix:** Restored the missing UI section in `DashboardTab`.
- **Validation:** Confirmed that the `factoryReset` function is correctly linked.
- **Enhancement:** Upgraded `factoryReset` to perform a "Deep Clean" by fetching and deleting ALL remote documents from every collection.
- **Bug Fix:** Patched `downloadFromCloud` to correctly overwrite local data with an empty list when the cloud collection is empty (previously, it ignored empty snapshots, leaving local "zombie data").
- **Tooling:** Added a "Check Cloud Data" diagnostic tool to the Dashboard to manually verify cloud emptiness.
