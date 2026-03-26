import { useState, useEffect } from 'react';
import SignIn from './components/SignIn';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('doubtSolverUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoaded(true);
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSignIn = (username) => {
    const userObj = { username };
    setUser(userObj);
    localStorage.setItem('doubtSolverUser', JSON.stringify(userObj));
    showToast(`Welcome back, ${username}!`);
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('doubtSolverUser');
  };

  if (!isLoaded) return null;

  return (
    <>
      <div className="bg-mesh"></div>
      
      {!user ? (
        <SignIn onSignIn={handleSignIn} />
      ) : (
        <Dashboard user={user} onSignOut={handleSignOut} showToast={showToast} />
      )}

      {/* Global Toast */}
      <div className={`toast glass-panel ${toastMsg ? 'show' : ''}`}>
        <i className="ri-information-line"></i>
        <span>{toastMsg}</span>
      </div>
    </>
  );
}

export default App;
