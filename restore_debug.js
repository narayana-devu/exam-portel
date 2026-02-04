const fs = require('fs');
const path = 'client/index.html';
const newPath = 'client/index_fixed.html';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);

    console.log(`Total lines: ${lines.length}`);

    const markers = [];
    lines.forEach((l, i) => {
        if (l.includes('// MAIN APP')) markers.push(i);
    });

    console.log(`Found // MAIN APP at lines: ${markers.join(', ')}`);

    if (markers.length > 0) {
        // We want to cut at the FIRST marker to be safe, assuming the first one starts the valid App component.
        // If the file was duplicated, the first one is the start of the first copy.
        const cutLine = markers[0];
        console.log(`Cutting at line ${cutLine + 1}`);

        const newLines = lines.slice(0, cutLine);

        const cleanTail = `        // MAIN APP
        const App = () => {
            const [user, setUser] = React.useState(null);

            React.useEffect(() => {
                try {
                    const saved = localStorage.getItem('se_user');
                    if (saved) setUser(JSON.parse(saved));
                } catch (e) { console.error(e); }
            }, []);

            const handleLogin = (u) => {
                localStorage.setItem('se_user', JSON.stringify(u));
                setUser(u);
            };

            const handleLogout = () => {
                localStorage.removeItem('se_user');
                setUser(null);
            };

            if (!user) {
                return <Login onLogin={handleLogin} />;
            }

            return <Dashboard user={user} onLogout={handleLogout} />;
        };

        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        root.render(<App />);
    </script>
</body>
</html>`;

        fs.writeFileSync(newPath, newLines.join('\n') + '\n' + cleanTail);
        console.log(`Wrote fixed content to ${newPath}`);
    } else {
        console.error('ERROR: Could not find // MAIN APP marker.');
    }
} catch (e) {
    console.error('Script failed:', e);
}
