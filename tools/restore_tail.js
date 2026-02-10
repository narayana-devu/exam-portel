const fs = require('fs');
const path = 'client/index.html';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);

    // Find the FIRST occurrence of "// MAIN APP" to be safe
    const startLine = lines.findIndex(l => l.includes('// MAIN APP'));

    if (startLine !== -1) {
        console.log(`Found // MAIN APP at line ${startLine + 1}`);

        // Keep everything BEFORE "// MAIN APP"
        const newLines = lines.slice(0, startLine);

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

        fs.writeFileSync(path, newLines.join('\n') + '\n' + cleanTail);
        console.log('Successfully restored index.html tail.');
    } else {
        console.error('ERROR: Could not find // MAIN APP marker.');
    }
} catch (e) {
    console.error('Script failed:', e);
}
